import fs from 'fs'
import path from 'path'
import { ulid } from 'ulid'
import {
  CreateRevisionPackageDTO, RevisionPackage, RevisionPackageJson,
  RevisionPackagePreview, RevisionPackageReviewItem
} from '@shared/types'
import { ProjectService } from './project.service'
import { ReviewService } from './review.service'
import { VersionService } from './version.service'

interface PackageFile {
  path: string
  size: number
  source?: string
  content?: string
}

function within(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

export class ExportService {
  constructor(
    private projectService: ProjectService,
    private reviewService: ReviewService,
    private versionService: VersionService
  ) {}

  private async plan(dto: CreateRevisionPackageDTO) {
    if (!Array.isArray(dto.commentIds) || !dto.commentIds.length || dto.commentIds.some((id) => typeof id !== 'string')) {
      throw new Error('Chọn ít nhất một bình luận để xuất.')
    }
    if (typeof dto.targetVersionName !== 'string' || !dto.targetVersionName.trim() || dto.targetVersionName.length > 120) {
      throw new Error('Tên phiên bản đích phải có từ 1 đến 120 ký tự.')
    }
    if (dto.instructions !== undefined && (typeof dto.instructions !== 'string' || dto.instructions.length > 2000)) {
      throw new Error('Hướng dẫn tối đa 2.000 ký tự.')
    }
    const project = await this.projectService.getProject(dto.projectId)
    if (!project) throw new Error('Không tìm thấy dự án.')
    const source = (await this.versionService.getVersions(dto.projectId)).find((version) => version.id === dto.sourceVersionId)
    if (!source) throw new Error('Phiên bản nguồn không thuộc dự án này.')
    const target = dto.targetVersionName.trim()
    if (target === source.name.trim()) throw new Error('Tên phiên bản đích phải khác phiên bản nguồn.')
    const all = await this.reviewService.getComments(dto.projectId, source.id)
    const requested = new Set(dto.commentIds)
    const comments = all.filter((comment) => requested.has(comment.id)).sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))
    if (comments.length !== requested.size) throw new Error('Có bình luận không thuộc phiên bản nguồn hoặc đã bị xóa. Hãy tải lại danh sách.')
    const root = fs.realpathSync(project.projectPath)
    const files: PackageFile[] = []
    const warnings: string[] = []
    const reviews: RevisionPackageReviewItem[] = []

    for (const comment of comments) {
      const item: RevisionPackageReviewItem = {
        id: comment.id, timestamp: comment.timestamp, frame: comment.frameNumber,
        category: comment.category.toLowerCase(), priority: comment.priority.toLowerCase(),
        status: comment.status.toLowerCase(), comment: comment.content
      }
      for (const [type, folder, property] of [
        ['FRAME', 'frames', 'frameImage'], ['ANNOTATED_FRAME', 'annotated', 'annotationImage']
      ] as const) {
        const attachment = comment.attachments?.find((value) => value.type === type)
        if (!attachment) {
          if (type === 'FRAME') warnings.push(`${comment.id}: bình luận chưa có frame gốc; chỉ xuất nội dung.`)
          continue
        }
        const candidate = path.resolve(root, attachment.filePath)
        if (!within(root, candidate)) throw new Error(`${comment.id}: đường dẫn ảnh nằm ngoài dự án.`)
        let absolute: string
        try { absolute = fs.realpathSync(candidate) } catch { throw new Error(`${comment.id}: thiếu ảnh đính kèm ${attachment.filePath}. Khôi phục tệp trước khi xuất.`) }
        if (!within(root, absolute) || !fs.statSync(absolute).isFile()) throw new Error(`${comment.id}: ảnh đính kèm không hợp lệ.`)
        const extension = path.extname(absolute).toLowerCase()
        if (!['.jpg', '.jpeg', '.png'].includes(extension)) throw new Error(`${comment.id}: định dạng ảnh không hỗ trợ.`)
        // Never derive output filenames from comment IDs or user-provided paths.
        const relative = `${folder}/${String(reviews.length + 1).padStart(4, '0')}${extension}`
        files.push({ path: relative, size: fs.statSync(absolute).size, source: absolute })
        item[property] = relative
      }
      if (comment.annotations?.length && !item.annotationImage) {
        throw new Error(`${comment.id}: có annotation nhưng chưa có PNG đã render.`)
      }
      reviews.push(item)
    }

    const now = new Date().toISOString()
    const instructions = dto.instructions || ''
    const review: RevisionPackageJson = {
      projectId: project.id, projectName: project.name, sourceVersionId: source.id,
      sourceVersion: source.name, targetVersion: target, exportedAt: now, instructions, reviews
    }
    const context = `Project: ${project.name}\nDescription: ${project.description || '(not specified)'}\nPlatform: ${project.targetPlatform || '(not specified)'}\nTarget duration (seconds): ${project.targetDuration ?? '(not specified)'}\nAspect ratio: ${project.aspectRatio || '(not specified)'}\nSource version: ${source.name}\nSource version ID: ${source.id}\nTarget version: ${target}`
    const instructionsText = `# Revision instructions\n\n${context}\n\n## User instructions\n\n${instructions || 'Apply the selected feedback in review.json. Do not infer additional edits.'}\n\n## Selected feedback\n\n${reviews.map((item) => `- ${item.id} @ ${item.timestamp.toFixed(3)}s [${item.priority}/${item.status}]: ${item.comment.replace(/\r?\n/g, ' ')}`).join('\n')}\n`
    const readme = `# FrameFlow Revision Package\n\n${context}\n\nExported: ${now}\nFeedback count: ${reviews.length}\n\n## Contents\n\n- review.json: selected feedback with timestamps in seconds and package-relative image paths.\n- instructions.md: project context and user instructions.\n- frames/: original captured JPEG/PNG frames, when available.\n- annotated/: separate rendered annotation PNGs, when available.\n\n## Usage\n\nRead instructions.md and review.json together. Open each referenced image relative to this folder. Timestamps belong only to the source version ID above. Frame numbers are estimates, not guaranteed exact frame indices. Original footage, source video, AI source analysis, preferences and locked segments are not included. This is a local folder export; nothing is sent to an external agent.\n${warnings.length ? `\n## Warnings\n\n${warnings.map((warning) => `- ${warning}`).join('\n')}\n` : ''}`
    for (const [filename, content] of [
      ['review.json', `${JSON.stringify(review, null, 2)}\n`], ['instructions.md', instructionsText], ['README.md', readme]
    ]) files.push({ path: filename, content, size: Buffer.byteLength(content, 'utf8') })
    files.sort((a, b) => a.path.localeCompare(b.path))
    return { project, source, root, now, instructions, files, review, warnings }
  }

  public async previewPackage(dto: CreateRevisionPackageDTO): Promise<RevisionPackagePreview> {
    const plan = await this.plan(dto)
    return {
      files: plan.files.map((file) => ({ path: file.path, size: file.size })),
      totalBytes: plan.files.reduce((sum, file) => sum + file.size, 0), review: plan.review, warnings: plan.warnings
    }
  }

  public async createPackage(dto: CreateRevisionPackageDTO): Promise<RevisionPackage> {
    // Rebuild and revalidate at export time; never trust an old UI preview.
    const plan = await this.plan(dto)
    const db = await this.projectService.getDb(dto.projectId)
    const exportRoot = path.join(plan.root, 'exports')
    fs.mkdirSync(exportRoot, { recursive: true })
    if (!within(plan.root, fs.realpathSync(exportRoot))) throw new Error('Thư mục exports nằm ngoài dự án.')
    const id = ulid()
    const versionLabel = Number.isSafeInteger(plan.source.versionNumber) && plan.source.versionNumber > 0 ? `V${plan.source.versionNumber}_` : ''
    const destination = path.join(exportRoot, `revision_${versionLabel}${id}`)
    const staging = fs.mkdtempSync(path.join(exportRoot, '.building-'))
    let published = false
    try {
      fs.mkdirSync(path.join(staging, 'frames'))
      fs.mkdirSync(path.join(staging, 'annotated'))
      for (const file of plan.files) {
        const output = path.join(staging, file.path)
        if (file.source) fs.copyFileSync(file.source, output, fs.constants.COPYFILE_EXCL)
        else fs.writeFileSync(output, file.content!, { encoding: 'utf8', flag: 'wx' })
      }
      db.transaction(() => {
        if (fs.existsSync(destination)) throw new Error('Đường dẫn gói đã tồn tại; hãy xuất lại để tạo ID mới.')
        fs.renameSync(staging, destination)
        published = true
        db.run(`INSERT INTO revision_packages (id, project_id, source_version_id, package_path, instructions, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`, [id, dto.projectId, dto.sourceVersionId, destination, plan.instructions, plan.now])
      })
      return { id, projectId: dto.projectId, sourceVersionId: dto.sourceVersionId, packagePath: destination, instructions: plan.instructions, createdAt: plan.now }
    } catch (error) {
      // Only remove the unique directory created by this operation, never an old package.
      fs.rmSync(published ? destination : staging, { recursive: true, force: true })
      throw error
    }
  }
}
