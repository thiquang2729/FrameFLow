const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createRequire } = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')
const xlsx = require('xlsx')

function load(relativePath) {
  const filename = path.resolve(__dirname, '..', relativePath)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText
  const module = { exports: {} }
  const localRequire = createRequire(filename)
  const requireModule = (name) => {
    if (name === '@shared/media') return load('src/shared/media.ts')
    if (name === '@shared/types') return load('src/shared/types/index.ts')
    if (name === './source-sidecar.service') return load('src/main/services/source-sidecar.service.ts')
    if (name === './script-parser.service') return load('src/main/services/script-parser.service.ts')
    if (name === './ai-video-adapter') return load('src/main/services/ai-video-adapter.ts')
    if (name === '../../shared/validation/source-analysis') return load('src/shared/validation/source-analysis.ts')
    return localRequire(name)
  }
  new Function('require', 'module', 'exports', output)(requireModule, module, module.exports)
  return module.exports
}

const { ScriptParserService } = load('src/main/services/script-parser.service.ts')
const { SourceSidecarService } = load('src/main/services/source-sidecar.service.ts')
const { validateSourceAnalysis } = load('src/shared/validation/source-analysis.ts')
const { sourceVideoPrompt, VIDEO_PROMPT_VERSION } = load('src/main/services/ai-video-adapter.ts')
const { DatabaseManager } = load('src/main/database/db.ts')

test('ScriptParserService parses TXT, MD, JSON, CSV and XLSX files cleanly', async (t) => {
  const base = process.platform === 'win32' && process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir()
  const dir = fs.mkdtempSync(path.join(base, 'script-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const parser = new ScriptParserService()

  // 1. TXT
  const txtPath = path.join(dir, 'script.txt')
  fs.writeFileSync(txtPath, 'Cảnh 1: Giới thiệu\nCảnh 2: Trải nghiệm', 'utf-8')
  const txtRes = await parser.parseFile(txtPath)
  assert.equal(txtRes.format, 'txt')
  assert.equal(txtRes.text, 'Cảnh 1: Giới thiệu\nCảnh 2: Trải nghiệm')

  // 2. MD
  const mdPath = path.join(dir, 'script.md')
  fs.writeFileSync(mdPath, '# Kịch bản tuyển sinh\n- Phân cảnh 1', 'utf-8')
  const mdRes = await parser.parseFile(mdPath)
  assert.equal(mdRes.format, 'md')
  assert.ok(mdRes.text.includes('# Kịch bản'))

  // 3. JSON with scenes
  const jsonPath = path.join(dir, 'script.json')
  fs.writeFileSync(jsonPath, JSON.stringify({
    scenes: [
      { scene: 1, dialogue: 'Xin chào', visual: 'Toàn cảnh' },
      { scene: 2, dialogue: 'Cảm ơn', visual: 'Cận cảnh' }
    ]
  }), 'utf-8')
  const jsonRes = await parser.parseFile(jsonPath)
  assert.equal(jsonRes.format, 'json')
  assert.ok(jsonRes.text.includes('[Cảnh 1]'))
  assert.ok(jsonRes.text.includes('Xin chào'))

  // 4. CSV
  const csvPath = path.join(dir, 'script.csv')
  fs.writeFileSync(csvPath, 'Cảnh,Thoại,Góc quay\n1,Xin chào,Trung cảnh\n2,Tạm biệt,Toàn cảnh', 'utf-8')
  const csvRes = await parser.parseFile(csvPath)
  assert.equal(csvRes.format, 'csv')
  assert.ok(csvRes.text.includes('Xin chào'))

  // 5. XLSX
  const xlsxPath = path.join(dir, 'script.xlsx')
  const wb = xlsx.utils.book_new()
  const ws = xlsx.utils.aoa_to_sheet([
    ['Cảnh', 'Lời thoại', 'Hình ảnh'],
    ['Cảnh 1', 'Chào mừng các bạn', 'VJ đứng tại cổng'],
    ['Cảnh 2', 'Hôm nay chúng ta sẽ khám phá phòng Lab', 'Góc tracking vào phòng Lab']
  ])
  xlsx.utils.book_append_sheet(wb, ws, 'PhanCanh')
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })
  fs.writeFileSync(xlsxPath, buf)
  const xlsxRes = await parser.parseFile(xlsxPath)
  assert.equal(xlsxRes.format, 'xlsx')
  assert.ok(xlsxRes.text.includes('Chào mừng các bạn'))
  assert.ok(xlsxRes.text.includes('Góc tracking'))

  // 6. Rejects unsupported extension
  const exePath = path.join(dir, 'bad.exe')
  fs.writeFileSync(exePath, 'not a script')
  await assert.rejects(async () => parser.parseFile(exePath), /chưa được hỗ trợ/)
})

test('SourceSidecarService saves and merges segments, dialogue and tags', async (t) => {
  const base = process.platform === 'win32' && process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir()
  const dir = fs.mkdtempSync(path.join(base, 'sidecar-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const videoPath = path.join(dir, 'footage_01.mp4')
  fs.writeFileSync(videoPath, 'fake-video-bytes')

  const sidecar = new SourceSidecarService()

  // 1. Initial save for range [0, 10]
  const initial = await sidecar.mergeAndSave(videoPath, {
    fingerprint: 'fp_abc123',
    duration: 60.0,
    width: 1920,
    height: 1080,
    fps: 30,
    fileSize: 1000,
    startTime: 0,
    endTime: 10,
    summary: 'Phân đoạn mở đầu giới thiệu',
    dialogue: [
      { startTime: 1.0, endTime: 5.0, speaker: 'VJ', text: 'Xin chào các bạn đã quay trở lại' }
    ],
    segments: [
      {
        startTime: 0, endTime: 10, summary: 'Toàn cảnh mở đầu', shotType: 'Wide',
        recommendedUse: 'Mở đầu video',
        scores: { technical: 8, editorial: 9, sharpness: 8, stability: 8, exposure: 8, composition: 8, audio: null, rationale: 'Hình ảnh ổn định' }
      }
    ],
    issues: [],
    tags: ['giới thiệu', 'vj']
  })

  assert.ok(initial)
  assert.equal(initial.version, '1.0')
  assert.equal(initial.dialogue.length, 1)
  assert.equal(initial.segments.length, 1)
  assert.deepEqual(initial.tags, ['giới thiệu', 'vj'])

  // Check file on disk
  const sidecarPath = sidecar.getSidecarPath(videoPath)
  assert.ok(fs.existsSync(sidecarPath))

  // 2. Merge another range [10, 25] with new dialogue and segments
  const merged = await sidecar.mergeAndSave(videoPath, {
    fingerprint: 'fp_abc123',
    duration: 60.0,
    width: 1920,
    height: 1080,
    fps: 30,
    fileSize: 1000,
    startTime: 10,
    endTime: 25,
    summary: 'Phân đoạn giới thiệu thiết bị',
    dialogue: [
      { startTime: 12.0, endTime: 18.0, speaker: 'VJ', text: 'Đây là cỗ máy rang thế hệ mới nhất' }
    ],
    segments: [
      {
        startTime: 10, endTime: 25, summary: 'Cận cảnh máy móc', shotType: 'Close-up',
        recommendedUse: 'B-roll minh họa',
        scores: { technical: 9, editorial: 8.5, sharpness: 9, stability: 8.5, exposure: 9, composition: 8.5, audio: null, rationale: 'Chi tiết sắc nét' }
      }
    ],
    issues: [
      { startTime: 15, endTime: 17, type: 'SHAKE', severity: 'LOW', description: 'Rung nhẹ khi lia máy', evidence: 'Camera lia nhanh' }
    ],
    tags: ['máy rang', 'thiết bị', 'vj']
  })

  assert.ok(merged)
  // Both dialogues preserved and ordered
  assert.equal(merged.dialogue.length, 2)
  assert.equal(merged.dialogue[0].startTime, 1.0)
  assert.equal(merged.dialogue[1].startTime, 12.0)
  assert.equal(merged.dialogue[1].text, 'Đây là cỗ máy rang thế hệ mới nhất')

  // Both segments preserved
  assert.equal(merged.segments.length, 2)
  assert.equal(merged.segments[0].shotType, 'Wide')
  assert.equal(merged.segments[1].shotType, 'Close-up')

  // Issues and Tags merged
  assert.equal(merged.issues.length, 1)
  assert.deepEqual(merged.tags.sort(), ['giới thiệu', 'máy rang', 'thiết bị', 'vj'].sort())

  // 3. Read back from disk
  const diskRead = await sidecar.readSidecar(videoPath)
  assert.ok(diskRead)
  assert.equal(diskRead.dialogue.length, 2)
  assert.equal(diskRead.segments.length, 2)
})

test('validateSourceAnalysis extracts dialogue, enforces audioObserved=false and scores.audio=null', () => {
  const input = {
    videoObserved: true,
    audioObserved: true, // Should be ignored/forced to false
    summary: 'Video phỏng vấn VJ',
    dialogue: [
      { startTime: 0.5, endTime: 4.2, speaker: 'VJ Tuấn', text: 'Chào mọi người, mình là Tuấn.' },
      { startTime: 5.0, endTime: 9.8, text: 'Hôm nay trời rất đẹp.' }
    ],
    segments: [
      {
        startTime: 0,
        endTime: 10,
        summary: 'Toàn cảnh mở đầu',
        shotType: 'Medium Shot',
        recommendedUse: 'Mở đầu kịch bản',
        scores: { technical: 8, editorial: 8, sharpness: 8, stability: 8, exposure: 8, composition: 8, audio: 9, rationale: 'Hình tốt' }
      }
    ],
    issues: [
      { startTime: 1, endTime: 2, type: 'AUDIO', severity: 'HIGH', description: 'Gió rít', evidence: 'Tiếng ồn' }, // Must be filtered out
      { startTime: 2, endTime: 3, type: 'SHAKE', severity: 'LOW', description: 'Rung nhẹ', evidence: 'Khung hình lắc' }
    ],
    tags: ['vj', 'phỏng vấn']
  }

  const validated = validateSourceAnalysis(input, 10, 0)
  assert.equal(validated.audioObserved, false)
  assert.equal(validated.dialogue.length, 2)
  assert.equal(validated.dialogue[0].speaker, 'VJ Tuấn')
  assert.equal(validated.dialogue[0].text, 'Chào mọi người, mình là Tuấn.')
  assert.equal(validated.dialogue[1].speaker, 'VJ') // default speaker
  assert.equal(validated.segments[0].scores.audio, null) // audio score forced to null
  assert.equal(validated.issues.length, 1) // AUDIO issue filtered out
  assert.equal(validated.issues[0].type, 'SHAKE')
})

test('sourceVideoPrompt instructs transcription without audio quality scoring', () => {
  const prompt = sourceVideoPrompt(15.0, JSON.stringify({ script: 'Cảnh 1: VJ chào khán giả' }), 'MP4 1080p')
  assert.ok(prompt.includes('CHÍNH SÁCH LỜI THOẠI & ÂM THANH'))
  assert.ok(prompt.includes('dialogue'))
  assert.ok(prompt.includes('TUYỆT ĐỐI KHÔNG đánh giá chất lượng âm thanh'))
  assert.ok(prompt.includes('audioObserved":false'))
})

test('Database migration src-analysis-v2-dialogue creates source_dialogues and persists rows', async (t) => {
  const base = process.platform === 'win32' && process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir()
  const dir = fs.mkdtempSync(path.join(base, 'db-migration-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const dbPath = path.join(dir, 'project.db')
  const db = new DatabaseManager(dbPath)
  await db.init()

  // Verify source_dialogues table exists
  const tables = db.query('SELECT name FROM sqlite_master WHERE type="table" AND name="source_dialogues"')
  assert.equal(tables.length, 1)

  // Verify migration is tracked
  const migration = db.get('SELECT * FROM module_migrations WHERE name = ?', ['src-analysis-v2-dialogue'])
  assert.ok(migration)
  assert.equal(migration.version, 2)

  db.close()
})
