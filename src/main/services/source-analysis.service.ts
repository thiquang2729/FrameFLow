import fs from 'node:fs/promises'
import path from 'node:path'
import { ulid } from 'ulid'
import type { ProjectService } from './project.service'
import type { AiService } from './ai.service'
import type { SourceMediaService } from './source-media.service'
import type { DatabaseManager } from '../database/db'
import type { AnalysisReview, AnalysisState, SourceAnalysisEnvironment, SourceAnalysisOverview, SourceAnalysisRequest, SourceAnalysisRun, SourceAnalysisSegment, SourceMediaInfo } from '../../shared/types/source-analysis'
import { validateSourceAnalysis } from '../../shared/validation/source-analysis'
import { sourceVideoPrompt, sourceScriptRealignPrompt, type RealignInputData, VIDEO_MAX_BYTES, VIDEO_MAX_DURATION, VIDEO_PROMPT_VERSION } from './ai-video-adapter'
import { SOURCE_EXTENSIONS, isSourceImage } from '../../shared/media'
import { SourceSidecarService } from './source-sidecar.service'

type Row = Record<string, any>
const identifier = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value)) throw new Error('Định danh SRC hoặc dự án không hợp lệ.')
  return value
}

export class SourceAnalysisService {
  private recovered = new Set<string>()
  private reserved = false
  private closing = false
  private active: { projectId: string; sourceAssetId: string; id: string; controller: AbortController; done: Promise<void> } | null = null
  private sidecar: SourceSidecarService

  constructor(private projects: ProjectService, private ai: AiService, private media: SourceMediaService, sidecar?: SourceSidecarService) {
    this.sidecar = sidecar || new SourceSidecarService()
  }

  private async context(projectId: string, sourceId: string): Promise<{ db: DatabaseManager; source: Row; project: NonNullable<Awaited<ReturnType<ProjectService['getProject']>>> }> {
    identifier(projectId); identifier(sourceId)
    const project = await this.projects.getProject(projectId)
    if (!project) throw new Error('Không tìm thấy dự án.')
    const db = await this.projects.getDb(projectId)
    const source = db.get<Row>('SELECT * FROM source_assets WHERE id = ? AND project_id = ?', [sourceId, projectId])
    if (!source) throw new Error('SRC không thuộc dự án này.')
    if (!this.recovered.has(projectId)) {
      db.run("UPDATE source_analysis_runs SET state = 'INTERRUPTED', error = ?, completed_at = ? WHERE project_id = ? AND state = 'RUNNING'", ['Phiên trước bị gián đoạn. Chọn phân tích lại để tạo lần chạy mới.', new Date().toISOString(), projectId])
      this.recovered.add(projectId)
    }
    return { db, source, project }
  }

  private brief(project: { description?: string; script?: string; targetPlatform?: string; targetDuration?: number; aspectRatio?: string }): string {
    return JSON.stringify({
      description: project.description || '',
      script: project.script || '',
      targetPlatform: project.targetPlatform || null,
      targetDuration: project.targetDuration || null,
      aspectRatio: project.aspectRatio || null
    })
  }

  async environment(): Promise<SourceAnalysisEnvironment> {
    const tools = await this.media.availability()
    const status = this.ai.getStatus()
    const models = status.state === 'ready' ? await this.ai.listVideoModelCandidates() : []
    const preferredModel = (status.srcModel && models.includes(status.srcModel))
      ? status.srcModel
      : (status.selectedModel && models.includes(status.selectedModel))
        ? status.selectedModel
        : (models[0] || '')
    return { mediaReady: tools.ready, mediaMessage: tools.message, aiReady: status.state === 'ready' && status.accounts > 0, models, selectedModel: preferredModel, videoRoute: 'UNVERIFIED', maxDuration: VIDEO_MAX_DURATION, maxVideoBytes: VIDEO_MAX_BYTES }
  }

  async probe(projectId: string, sourceId: string): Promise<SourceMediaInfo> {
    const { db, source } = await this.context(projectId, sourceId)
    if (/\.(jpe?g|png)$/i.test(source.original_path)) throw new Error('Đây là ảnh tĩnh, không có thông số video.')
    const info = await this.media.probe(source.original_path, AbortSignal.timeout(45000))
    db.run('UPDATE source_assets SET duration = ?, width = ?, height = ?, fps = ?, codec = ?, file_size = ? WHERE id = ? AND project_id = ?', [info.duration, info.width, info.height, info.fps, info.codec, info.fileSize, sourceId, projectId])
    return info
  }

  async relink(projectId: string, sourceId: string, filePath: string): Promise<void> {
    const { db, source } = await this.context(projectId, sourceId)
    if (this.active?.projectId === projectId && this.active.sourceAssetId === sourceId) throw new Error('Hãy hủy phân tích trước khi liên kết lại SRC.')
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) throw new Error('Đường dẫn tệp không hợp lệ.')
    const file = await fs.realpath(filePath)
    const stats = await fs.stat(file)
    if (!stats.isFile() || !SOURCE_EXTENSIONS.includes(path.extname(file).slice(1).toLowerCase()) || isSourceImage(file) !== isSourceImage(source.original_path)) throw new Error('Chọn tệp cùng loại ảnh/video với SRC ban đầu.')
    const key = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value
    if (db.query<{ id: string; original_path: string }>('SELECT id, original_path FROM source_assets WHERE project_id = ?', [projectId]).some((row) => row.id !== sourceId && key(row.original_path) === key(file))) throw new Error('Tệp này đã được nhập thành một SRC khác trong dự án.')
    if (this.active?.projectId === projectId && this.active.sourceAssetId === sourceId) throw new Error('Hãy hủy phân tích trước khi liên kết lại SRC.')
    db.run('UPDATE source_assets SET original_path = ?, filename = ?, file_size = ?, duration = NULL, width = NULL, height = NULL, fps = NULL, codec = NULL, thumbnail_path = NULL, proxy_path = NULL, file_hash = NULL WHERE id = ? AND project_id = ?', [file, path.basename(file), stats.size, sourceId, projectId])
  }

  async hydrateFromSidecar(projectId: string, sourceId: string): Promise<boolean> {
    try {
      const { db, source } = await this.context(projectId, sourceId)
      const existing = db.get<{ count: number }>('SELECT COUNT(*) as count FROM source_analysis_runs WHERE project_id = ? AND source_asset_id = ?', [projectId, sourceId])
      if (existing && existing.count > 0) return false

      const sidecarData = await this.sidecar.readSidecar(source.original_path)
      if (!sidecarData || !sidecarData.segments || !sidecarData.segments.length) return false

      const runId = ulid()
      const now = new Date().toISOString()
      let fingerprint = sidecarData.source?.fingerprint
      if (!fingerprint) {
        try { fingerprint = await this.media.fingerprint(source.original_path) } catch { fingerprint = 'sidecar-cached' }
      }
      const startTime = sidecarData.segments[0]?.startTime ?? 0
      const endTime = sidecarData.segments[sidecarData.segments.length - 1]?.endTime ?? sidecarData.source?.duration ?? 60

      db.transaction(() => {
        db.run(`INSERT INTO source_analysis_runs
          (id, project_id, source_asset_id, state, model, protocol, prompt_version, brief, file_fingerprint, start_time, end_time, summary, audio_observed, media_method, media_note, review, created_at, completed_at)
          VALUES (?, ?, ?, 'COMPLETED', 'sidecar-cache', 'gemini-inline-video', ?, '', ?, ?, ?, ?, 0, 'original', 'Được nạp từ tệp sidecar có sẵn', 'UNREVIEWED', ?, ?)`,
          [runId, projectId, sourceId, VIDEO_PROMPT_VERSION, fingerprint, startTime, endTime, sidecarData.overallSummary || '', sidecarData.updatedAt || now, now]
        )
        for (const segment of sidecarData.segments) {
          db.run('INSERT INTO source_segments (id, analysis_run_id, start_time, end_time, summary, shot_type, recommended_use, scores_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [ulid(), runId, segment.startTime, segment.endTime, segment.summary, segment.shotType, segment.recommendedUse, JSON.stringify(segment.scores)]
          )
        }
        for (const issue of sidecarData.issues) {
          db.run('INSERT INTO source_issues (id, analysis_run_id, start_time, end_time, type, severity, description, evidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [ulid(), runId, issue.startTime, issue.endTime, issue.type, issue.severity, issue.description, issue.evidence]
          )
        }
        for (const tag of sidecarData.tags) {
          db.run("INSERT INTO source_tags (id, source_asset_id, analysis_run_id, tag, source) VALUES (?, ?, ?, ?, 'AI')",
            [ulid(), sourceId, runId, tag]
          )
        }
        if (Array.isArray(sidecarData.dialogue)) {
          for (const line of sidecarData.dialogue) {
            db.run('INSERT INTO source_dialogues (id, analysis_run_id, source_asset_id, start_time, end_time, speaker, text) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [ulid(), runId, sourceId, line.startTime, line.endTime, line.speaker || null, line.text]
            )
          }
        }
      })
      return true
    } catch (err) {
      console.warn(`[SourceAnalysis] Không thể hydrate từ sidecar cho SRC ${sourceId}:`, err)
      return false
    }
  }

  async list(projectId: string, sourceId: string): Promise<SourceAnalysisRun[]> {
    const { db, source, project } = await this.context(projectId, sourceId)
    let fingerprint: string | null = null
    try { fingerprint = await this.media.fingerprint(source.original_path) } catch { /* Missing source is stale, not lost history. */ }
    const brief = this.brief(project)
    let rows = db.query<Row>('SELECT * FROM source_analysis_runs WHERE project_id = ? AND source_asset_id = ? ORDER BY created_at DESC, id DESC LIMIT 100', [projectId, sourceId])
    if (rows.length === 0) {
      const hydrated = await this.hydrateFromSidecar(projectId, sourceId)
      if (hydrated) {
        rows = db.query<Row>('SELECT * FROM source_analysis_runs WHERE project_id = ? AND source_asset_id = ? ORDER BY created_at DESC, id DESC LIMIT 100', [projectId, sourceId])
      }
    }
    const userTags = db.query<{ tag: string }>("SELECT tag FROM source_tags WHERE source_asset_id = ? AND source = 'USER' ORDER BY tag", [sourceId]).map((row) => row.tag)
    return rows.map((row) => ({
      id: row.id, sourceAssetId: sourceId, state: row.state, model: row.model, returnedModel: row.returned_model,
      protocol: row.protocol, promptVersion: row.prompt_version, createdAt: row.created_at, completedAt: row.completed_at,
      startTime: row.start_time, endTime: row.end_time, summary: row.summary, audioObserved: Boolean(row.audio_observed),
      mediaMethod: row.media_method, mediaNote: row.media_note, review: row.review, userNote: row.user_note,
      brief: row.brief, error: row.error, stale: fingerprint !== row.file_fingerprint || brief !== row.brief || row.prompt_version !== VIDEO_PROMPT_VERSION,
      fileChanged: fingerprint !== row.file_fingerprint, briefChanged: brief !== row.brief, criteriaChanged: row.prompt_version !== VIDEO_PROMPT_VERSION,
      segments: db.query<Row>('SELECT * FROM source_segments WHERE analysis_run_id = ? ORDER BY start_time', [row.id]).map((segment) => ({ id: segment.id, startTime: segment.start_time, endTime: segment.end_time, summary: segment.summary, shotType: segment.shot_type, recommendedUse: segment.recommended_use, scores: JSON.parse(segment.scores_json) })),
      issues: db.query<Row>("SELECT * FROM source_issues WHERE analysis_run_id = ? AND type <> 'AUDIO' ORDER BY start_time", [row.id]).map((issue) => ({ id: issue.id, startTime: issue.start_time, endTime: issue.end_time, type: issue.type, severity: issue.severity, description: issue.description, evidence: issue.evidence })),
      dialogue: db.query<Row>('SELECT * FROM source_dialogues WHERE analysis_run_id = ? ORDER BY start_time', [row.id]).map((d) => ({ id: d.id, startTime: d.start_time, endTime: d.end_time, speaker: d.speaker || undefined, text: d.text })),
      tags: db.query<{ tag: string }>("SELECT tag FROM source_tags WHERE analysis_run_id = ? AND source = 'AI' ORDER BY tag", [row.id]).map((tag) => tag.tag), userTags
    }))
  }

  async overview(projectId: string): Promise<SourceAnalysisOverview[]> {
    identifier(projectId)
    const project = await this.projects.getProject(projectId)
    if (!project) throw new Error('Không tìm thấy dự án.')
    const db = await this.projects.getDb(projectId)
    if (!this.recovered.has(projectId)) {
      db.run("UPDATE source_analysis_runs SET state = 'INTERRUPTED', error = ?, completed_at = ? WHERE project_id = ? AND state = 'RUNNING'", ['Phiên trước bị gián đoạn. Chọn phân tích lại để tạo lần chạy mới.', new Date().toISOString(), projectId])
      this.recovered.add(projectId)
    }

    // Hydrate any source assets that have existing sidecars but no runs in DB
    const unanalyzed = db.query<{ id: string }>(
      'SELECT id FROM source_assets WHERE project_id = ? AND id NOT IN (SELECT DISTINCT source_asset_id FROM source_analysis_runs WHERE project_id = ?)',
      [projectId, projectId]
    )
    for (const item of unanalyzed) {
      await this.hydrateFromSidecar(projectId, item.id)
    }

    // A single library request, not one full history IPC call per thumbnail.
    const rows = db.query<Row>(`SELECT a.id AS source_id, a.original_path,
      latest.state AS latest_state, completed.*
      FROM source_assets a
      LEFT JOIN source_analysis_runs latest ON latest.id = (
        SELECT r.id FROM source_analysis_runs r WHERE r.source_asset_id = a.id AND r.project_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 1)
      LEFT JOIN source_analysis_runs completed ON completed.id = (
        SELECT r.id FROM source_analysis_runs r WHERE r.source_asset_id = a.id AND r.project_id = ? AND r.state = 'COMPLETED' ORDER BY r.created_at DESC, r.id DESC LIMIT 1)
      WHERE a.project_id = ? AND latest.id IS NOT NULL`, [projectId, projectId, projectId])
    const result: SourceAnalysisOverview[] = []
    for (const row of rows) {
      let stale = false
      let fileChanged = false
      let briefChanged = false
      if (row.id) {
        try {
          const currentFp = await this.media.fingerprint(row.original_path)
          fileChanged = currentFp !== row.file_fingerprint
          briefChanged = row.brief !== this.brief(project)
          stale = fileChanged || briefChanged || row.prompt_version !== VIDEO_PROMPT_VERSION
        } catch {
          stale = true
          fileChanged = true
        }
      }
      const segments = row.id ? db.query<Row>('SELECT start_time, end_time, shot_type, recommended_use, scores_json FROM source_segments WHERE analysis_run_id = ? ORDER BY start_time LIMIT 60', [row.id]) : []
      const first = segments[0]
      const scores = first ? JSON.parse(first.scores_json) : null
      const tags = db.query<{ tag: string }>("SELECT tag FROM source_tags WHERE source_asset_id = ? AND (source = 'USER' OR (source = 'AI' AND analysis_run_id = ?)) ORDER BY source DESC, tag", [row.source_id, row.id || null]).map((tag) => tag.tag)
      const dialogueCount = row.id ? (db.get<{ count: number }>('SELECT COUNT(*) as count FROM source_dialogues WHERE analysis_run_id = ?', [row.id])?.count || 0) : 0
      result.push({ sourceAssetId: row.source_id, latestState: row.latest_state, runId: row.id || null,
        summary: row.summary || '', technical: scores?.technical ?? null, editorial: scores?.editorial ?? null,
        startTime: first?.start_time ?? null, endTime: first?.end_time ?? null, tags: [...new Set(tags)],
        shotTypes: [...new Set<string>(segments.map((item) => item.shot_type).filter(Boolean))],
        recommendedUses: [...new Set<string>(segments.map((item) => item.recommended_use).filter(Boolean))],
        issueTypes: row.id ? db.query<{ type: string }>("SELECT DISTINCT type FROM source_issues WHERE analysis_run_id = ? AND type <> 'AUDIO'", [row.id]).map((issue) => issue.type) : [],
        dialogueCount,
        stale, fileChanged, briefChanged, rejected: row.review === 'REJECTED' })
    }
    return result
  }

  async start(request: SourceAnalysisRequest): Promise<{ id: string }> {
    if (!request || request.consent !== true) throw new Error('Cần xác nhận trước khi gửi video tới dịch vụ AI.')
    if (this.closing) throw new Error('Ứng dụng đang đóng.')
    if (this.reserved || this.active) throw new Error('Đang xử lý một video. Hãy chờ hoặc hủy tác vụ hiện tại.')
    if (typeof request.model !== 'string' || request.model.length > 200) throw new Error('Model không hợp lệ.')
    if (!Number.isFinite(request.startTime) || !Number.isFinite(request.endTime) || request.startTime < 0 || request.endTime <= request.startTime || request.endTime - request.startTime > VIDEO_MAX_DURATION) throw new Error('Chọn đoạn từ 0 đến tối đa 60 giây.')
    this.reserved = true
    try {
      const { db, source, project } = await this.context(request.projectId, request.sourceAssetId)
      if (/\.(jpe?g|png)$/i.test(source.original_path)) throw new Error('Tính năng này nhận video, không nhận ảnh thumbnail.')
      const environment = await this.environment()
      if (!environment.mediaReady) throw new Error(environment.mediaMessage)
      if (!environment.aiReady || !environment.models.includes(request.model)) throw new Error('Hãy đăng nhập Antigravity và chọn model Gemini khả dụng.')
      const id = ulid()
      const controller = new AbortController()
      const fingerprint = await this.media.fingerprint(source.original_path)
      if (this.closing) throw new Error('Ứng dụng đang đóng.')
      const brief = this.brief(project)
      db.run(`INSERT INTO source_analysis_runs
        (id, project_id, source_asset_id, state, model, protocol, prompt_version, brief, file_fingerprint, start_time, end_time, created_at)
        VALUES (?, ?, ?, 'RUNNING', ?, 'gemini-inline-video', ?, ?, ?, ?, ?, ?)`,
      [id, project.id, source.id, request.model, VIDEO_PROMPT_VERSION, brief, fingerprint, request.startTime, request.endTime, new Date().toISOString()])
      // Defer work until active is assigned; cancellation and shutdown always own the task.
      const done = Promise.resolve().then(() => this.perform({ ...request }, id, fingerprint, brief, project.projectPath, source.original_path, db, controller.signal))
        .finally(() => { if (this.active?.id === id) this.active = null })
      this.active = { projectId: project.id, sourceAssetId: source.id, id, controller, done }
      return { id }
    } finally { this.reserved = false }
  }

  private async perform(request: SourceAnalysisRequest, id: string, fingerprint: string, brief: string, projectPath: string, file: string, db: DatabaseManager, signal: AbortSignal): Promise<void> {
    const directory = path.join(projectPath, 'analysis-cache', id)
    let ownsDirectory = false
    try {
      const info = await this.media.probe(file, signal)
      if (info.fingerprint !== fingerprint) throw new Error('File SRC đã thay đổi trước khi phân tích. Hãy chạy lại.')

      // Check if we can perform lightning-fast Re-align from existing JSON analysis
      const previousRun = !request.forceFullVideo
        ? db.get<Row>(
            `SELECT r.id, r.brief, r.prompt_version, r.summary, r.file_fingerprint, r.start_time, r.end_time, r.media_method, r.media_note, r.audio_observed
             FROM source_analysis_runs r
             WHERE r.project_id = ? AND r.source_asset_id = ? AND r.state = 'COMPLETED' AND r.file_fingerprint = ?
             ORDER BY r.created_at DESC, r.id DESC LIMIT 1`,
            [request.projectId, request.sourceAssetId, fingerprint]
          )
        : null

      const canRealign =
        previousRun != null &&
        previousRun.brief !== brief &&
        previousRun.prompt_version === VIDEO_PROMPT_VERSION &&
        Math.abs((previousRun.start_time || 0) - request.startTime) < 0.1 &&
        Math.abs((previousRun.end_time || 0) - request.endTime) < 0.1

      if (canRealign) {
        const prevSegments = db.query<Row>(
          'SELECT * FROM source_segments WHERE analysis_run_id = ? ORDER BY start_time',
          [previousRun.id]
        )
        if (prevSegments.length > 0) {
          await this.performRealign(request, id, fingerprint, brief, previousRun, prevSegments, file, info, db, signal)
          return
        }
      }

      const cache = path.dirname(directory)
      await fs.mkdir(cache, { recursive: true })
      const projectRoot = await fs.realpath(projectPath)
      const cacheRoot = await fs.realpath(cache)
      const comparable = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value
      if (comparable(cacheRoot) !== comparable(path.join(projectRoot, 'analysis-cache')) || (await fs.lstat(cache)).isSymbolicLink()) throw new Error('Thư mục cache phân tích không được là liên kết ra ngoài dự án.')
      await fs.mkdir(directory)
      ownsDirectory = true
      const media = await this.media.prepare(file, info, request.startTime, request.endTime, directory, signal)
      signal.throwIfAborted()
      if (await this.media.fingerprint(file) !== fingerprint) throw new Error('File SRC đã thay đổi khi chuẩn bị video.')
      db.run('UPDATE source_analysis_runs SET media_method = ?, media_note = ? WHERE id = ?', [media.method, media.note, id])
      const response = await this.ai.generateVideo(request.model, media.bytes, media.mimeType, sourceVideoPrompt(media.duration, brief, media.note), signal)
      signal.throwIfAborted()
      let json: unknown
      try { json = JSON.parse(response.text) } catch { throw new Error('AI không trả JSON hợp lệ. Không lưu kết quả chưa kiểm tra.') }
      const result = validateSourceAnalysis(json, media.duration, request.startTime)
      if (await this.media.fingerprint(file) !== fingerprint) throw new Error('File SRC đã thay đổi trong khi chờ AI. Kết quả không được công bố.')
      // Verify the project/source still exists after asynchronous IO.
      if (!await this.projects.getProject(request.projectId) || !db.get('SELECT id FROM source_assets WHERE project_id = ? AND id = ?', [request.projectId, request.sourceAssetId])) throw new Error('Dự án hoặc SRC không còn tồn tại.')
      signal.throwIfAborted()
      db.transaction(() => {
        for (const segment of result.segments) db.run('INSERT INTO source_segments (id, analysis_run_id, start_time, end_time, summary, shot_type, recommended_use, scores_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [ulid(), id, segment.startTime, segment.endTime, segment.summary, segment.shotType, segment.recommendedUse, JSON.stringify(segment.scores)])
        for (const issue of result.issues) db.run('INSERT INTO source_issues (id, analysis_run_id, start_time, end_time, type, severity, description, evidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [ulid(), id, issue.startTime, issue.endTime, issue.type, issue.severity, issue.description, issue.evidence])
        for (const tag of result.tags) db.run("INSERT INTO source_tags (id, source_asset_id, analysis_run_id, tag, source) VALUES (?, ?, ?, ?, 'AI')", [ulid(), request.sourceAssetId, id, tag])
        for (const line of result.dialogue) db.run('INSERT INTO source_dialogues (id, analysis_run_id, source_asset_id, start_time, end_time, speaker, text) VALUES (?, ?, ?, ?, ?, ?, ?)', [ulid(), id, request.sourceAssetId, line.startTime, line.endTime, line.speaker || null, line.text])
        db.run("UPDATE source_analysis_runs SET state = 'COMPLETED', summary = ?, audio_observed = ?, returned_model = ?, completed_at = ? WHERE id = ?", [result.summary, result.audioObserved ? 1 : 0, response.returnedModel, new Date().toISOString(), id])
      })
      await this.sidecar.mergeAndSave(file, {
        fingerprint,
        duration: info.duration,
        width: info.width,
        height: info.height,
        fps: info.fps,
        fileSize: info.fileSize,
        startTime: request.startTime,
        endTime: request.endTime,
        summary: result.summary,
        dialogue: result.dialogue,
        segments: result.segments,
        issues: result.issues,
        tags: result.tags
      })
    } catch (error) {
      const message = signal.aborted ? 'Đã hủy phân tích.' : error instanceof Error ? error.message : 'Phân tích video thất bại.'
      try { db.run('UPDATE source_analysis_runs SET state = ?, error = ?, completed_at = ? WHERE id = ?', [signal.aborted ? 'CANCELLED' : 'FAILED', message.slice(0, 2000), new Date().toISOString(), id]) } catch { /* Project may have been closed/deleted; never recreate it here. */ }
    } finally {
      if (ownsDirectory) await fs.rm(directory, { recursive: true, force: true }).catch(() => {})
    }
  }

  private async performRealign(
    request: SourceAnalysisRequest,
    id: string,
    fingerprint: string,
    brief: string,
    previousRun: Row,
    prevSegments: Row[],
    file: string,
    info: SourceMediaInfo,
    db: DatabaseManager,
    signal: AbortSignal
  ): Promise<void> {
    const prevDialogues = db.query<Row>(
      'SELECT * FROM source_dialogues WHERE analysis_run_id = ? ORDER BY start_time',
      [previousRun.id]
    )
    const prevTags = db.query<{ tag: string }>(
      "SELECT tag FROM source_tags WHERE analysis_run_id = ? AND source = 'AI' ORDER BY tag",
      [previousRun.id]
    ).map((t) => t.tag)
    const prevIssues = db.query<Row>(
      'SELECT * FROM source_issues WHERE analysis_run_id = ? ORDER BY start_time',
      [previousRun.id]
    )

    const existingData: RealignInputData = {
      summary: previousRun.summary || '',
      dialogue: prevDialogues.map((d) => ({
        startTime: d.start_time,
        endTime: d.end_time,
        speaker: d.speaker || undefined,
        text: d.text
      })),
      segments: prevSegments.map((s) => {
        let scores: any = {}
        try { scores = JSON.parse(s.scores_json) } catch {}
        return {
          startTime: s.start_time,
          endTime: s.end_time,
          shotType: s.shot_type,
          summary: s.summary,
          technicalScore: scores?.technical ?? null
        }
      }),
      tags: prevTags
    }

    const duration = request.endTime - request.startTime
    const prompt = sourceScriptRealignPrompt(duration, brief, existingData)
    const mediaNote = 'Đối chiếu kịch bản từ JSON phân tích trước đó (siêu tốc, không tải lại video)'
    db.run("UPDATE source_analysis_runs SET media_method = 'realigned-from-json', media_note = ? WHERE id = ?", [mediaNote, id])

    const response = await this.ai.generateJson(request.model, prompt, signal)
    signal.throwIfAborted()

    let json: any
    try {
      json = JSON.parse(response.text)
    } catch {
      throw new Error('AI không trả JSON hợp lệ khi đối chiếu kịch bản.')
    }

    const realignedSegments: Array<{ index: number; editorial?: number | null; rationale?: string; recommendedUse?: string }> =
      Array.isArray(json?.segments) ? json.segments : []
    const realignedMap = new Map<number, { editorial?: number | null; rationale?: string; recommendedUse?: string }>()
    for (const item of realignedSegments) {
      if (typeof item?.index === 'number') realignedMap.set(item.index, item)
    }

    const newTags: string[] = Array.isArray(json?.tags)
      ? [...new Set([...prevTags, ...json.tags.filter((t: any) => typeof t === 'string' && t.trim())])]
      : prevTags
    const newSummary = typeof json?.summary === 'string' && json.summary.trim() ? json.summary.trim() : previousRun.summary || ''

    if (!await this.projects.getProject(request.projectId) || !db.get('SELECT id FROM source_assets WHERE project_id = ? AND id = ?', [request.projectId, request.sourceAssetId])) {
      throw new Error('Dự án hoặc SRC không còn tồn tại.')
    }
    signal.throwIfAborted()

    const finalSegments: SourceAnalysisSegment[] = []

    db.transaction(() => {
      prevSegments.forEach((seg, idx) => {
        const segId = ulid()
        let scores: Record<string, any> = {}
        try { scores = JSON.parse(seg.scores_json) } catch {}

        const realigned = realignedMap.get(idx)
        if (realigned) {
          if (typeof realigned.editorial === 'number' && Number.isFinite(realigned.editorial)) {
            scores.editorial = Math.max(0, Math.min(10, Math.round(realigned.editorial * 10) / 10))
          }
          if (typeof realigned.rationale === 'string' && realigned.rationale.trim()) {
            scores.rationale = realigned.rationale.trim()
          }
        }
        const recommendedUse = realigned?.recommendedUse && typeof realigned.recommendedUse === 'string'
          ? realigned.recommendedUse.trim()
          : seg.recommended_use || ''

        const finalScore = {
          technical: scores?.technical ?? null,
          editorial: scores?.editorial ?? null,
          sharpness: scores?.sharpness ?? null,
          stability: scores?.stability ?? null,
          exposure: scores?.exposure ?? null,
          composition: scores?.composition ?? null,
          audio: scores?.audio ?? null,
          rationale: scores?.rationale || ''
        }

        finalSegments.push({
          id: segId,
          startTime: seg.start_time,
          endTime: seg.end_time,
          summary: seg.summary || '',
          shotType: seg.shot_type || '',
          recommendedUse,
          scores: finalScore
        })

        db.run(
          'INSERT INTO source_segments (id, analysis_run_id, start_time, end_time, summary, shot_type, recommended_use, scores_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [segId, id, seg.start_time, seg.end_time, seg.summary, seg.shot_type, recommendedUse, JSON.stringify(finalScore)]
        )
      })

      for (const issue of prevIssues) {
        db.run(
          'INSERT INTO source_issues (id, analysis_run_id, start_time, end_time, type, severity, description, evidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [ulid(), id, issue.start_time, issue.end_time, issue.type, issue.severity, issue.description, issue.evidence]
        )
      }

      for (const tag of newTags) {
        db.run(
          "INSERT INTO source_tags (id, source_asset_id, analysis_run_id, tag, source) VALUES (?, ?, ?, ?, 'AI')",
          [ulid(), request.sourceAssetId, id, tag]
        )
      }

      for (const line of prevDialogues) {
        db.run(
          'INSERT INTO source_dialogues (id, analysis_run_id, source_asset_id, start_time, end_time, speaker, text) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [ulid(), id, request.sourceAssetId, line.start_time, line.end_time, line.speaker || null, line.text]
        )
      }

      db.run(
        "UPDATE source_analysis_runs SET state = 'COMPLETED', summary = ?, audio_observed = ?, returned_model = ?, completed_at = ? WHERE id = ?",
        [newSummary, previousRun.audio_observed ? 1 : 0, response.returnedModel, new Date().toISOString(), id]
      )
    })

    await this.sidecar.mergeAndSave(file, {
      fingerprint,
      duration: info.duration,
      width: info.width,
      height: info.height,
      fps: info.fps,
      fileSize: info.fileSize,
      startTime: request.startTime,
      endTime: request.endTime,
      summary: newSummary,
      dialogue: prevDialogues.map((d) => ({ startTime: d.start_time, endTime: d.end_time, speaker: d.speaker || undefined, text: d.text })),
      segments: finalSegments,
      issues: prevIssues.map((issue) => ({ startTime: issue.start_time, endTime: issue.end_time, type: issue.type, severity: issue.severity, description: issue.description, evidence: issue.evidence })),
      tags: newTags
    }).catch(() => {})
  }

  async cancel(projectId: string, sourceId: string, runId: string): Promise<void> {
    await this.context(projectId, sourceId)
    identifier(runId)
    if (this.active?.id === runId && this.active.projectId === projectId && this.active.sourceAssetId === sourceId) this.active.controller.abort()
  }

  async wait(projectId: string, sourceId: string, runId: string): Promise<{ state: AnalysisState; error?: string }> {
    identifier(projectId)
    identifier(sourceId)
    identifier(runId)
    if (this.active?.id === runId && this.active.projectId === projectId && this.active.sourceAssetId === sourceId) {
      await this.active.done.catch(() => {})
    }
    const { db } = await this.context(projectId, sourceId)
    const run = db.get<{ state: AnalysisState; error: string | null }>(
      'SELECT state, error FROM source_analysis_runs WHERE id = ?',
      [runId]
    )
    return {
      state: run?.state || 'FAILED',
      error: run?.error || undefined
    }
  }

  async review(projectId: string, sourceId: string, runId: string, review: AnalysisReview, note: string, tags: string[]): Promise<void> {
    const { db } = await this.context(projectId, sourceId)
    identifier(runId)
    if (!['UNREVIEWED', 'ACCEPTED', 'REJECTED'].includes(review) || typeof note !== 'string' || note.length > 2000 || !Array.isArray(tags) || tags.length > 30 || tags.some((tag) => typeof tag !== 'string' || tag.length > 100)) throw new Error('Đánh giá hoặc tag người dùng không hợp lệ.')
    if (!db.get("SELECT id FROM source_analysis_runs WHERE id = ? AND project_id = ? AND source_asset_id = ? AND state = 'COMPLETED'", [runId, projectId, sourceId])) throw new Error('Không tìm thấy kết quả đã hoàn tất của SRC này.')
    db.transaction(() => {
      db.run('UPDATE source_analysis_runs SET review = ?, user_note = ? WHERE id = ?', [review, note.trim(), runId])
      db.run("DELETE FROM source_tags WHERE source_asset_id = ? AND source = 'USER'", [sourceId])
      for (const tag of [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]) db.run("INSERT INTO source_tags (id, source_asset_id, tag, source) VALUES (?, ?, ?, 'USER')", [ulid(), sourceId, tag])
    })
  }

  async remove(projectId: string, sourceId: string): Promise<void> {
    await this.removeMany(projectId, [sourceId])
  }

  async removeMany(projectId: string, sourceIds: string[]): Promise<number> {
    if (!Array.isArray(sourceIds) || sourceIds.length === 0) return 0
    if (sourceIds.length > 500) throw new Error('Tối đa 500 SRC mỗi lần xóa.')
    if (this.reserved) throw new Error('Đang chuẩn bị tác vụ SRC khác. Hãy chờ rồi xóa lại.')
    this.reserved = true
    try {
      identifier(projectId)
      sourceIds.forEach(identifier)
      if (!await this.projects.getProject(projectId)) throw new Error('Dự án không còn tồn tại.')
      const db = await this.projects.getDb(projectId)
      const task = this.active
      if (task && task.projectId === projectId && sourceIds.includes(task.sourceAssetId)) {
        task.controller.abort()
        await task.done
      }
      let removed = 0
      db.transaction(() => {
        for (const sourceId of sourceIds) {
          const existing = db.get<{ id: string }>('SELECT id FROM source_assets WHERE project_id = ? AND id = ?', [projectId, sourceId])
          if (!existing) continue
          db.run('DELETE FROM source_tags WHERE source_asset_id = ?', [sourceId])
          db.run('DELETE FROM source_issues WHERE analysis_run_id IN (SELECT id FROM source_analysis_runs WHERE project_id = ? AND source_asset_id = ?)', [projectId, sourceId])
          db.run('DELETE FROM source_segments WHERE analysis_run_id IN (SELECT id FROM source_analysis_runs WHERE project_id = ? AND source_asset_id = ?)', [projectId, sourceId])
          db.run('DELETE FROM source_analysis_runs WHERE project_id = ? AND source_asset_id = ?', [projectId, sourceId])
          db.run('DELETE FROM source_assets WHERE project_id = ? AND id = ?', [projectId, sourceId])
          removed++
        }
      })
      return removed
    } finally { this.reserved = false }
  }

  async stop(): Promise<void> {
    this.closing = true
    const current = this.active
    current?.controller.abort()
    await current?.done
  }
}
