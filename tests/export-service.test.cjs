const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createRequire } = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')

function load(relativePath) {
  const filename = path.resolve(__dirname, '..', relativePath)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', output)(createRequire(filename), module, module.exports)
  return module.exports
}
const { DatabaseManager } = load('src/main/database/db.ts')
const { ExportService } = load('src/main/services/export.service.ts')
const { ReviewService } = load('src/main/services/review.service.ts')
const { VersionService } = load('src/main/services/version.service.ts')

async function fixture(t) {
  const base = process.platform === 'win32' && process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir()
  fs.mkdirSync(base, { recursive: true })
  const directory = fs.mkdtempSync(path.join(base, 'frameflow-export-test-'))
  const projectPath = path.join(directory, 'project')
  const dbPath = path.join(projectPath, 'project.db')
  let db = new DatabaseManager(dbPath)
  await db.init()
  t.after(() => { db.close(); fs.rmSync(directory, { recursive: true, force: true }) })
  const project = { id: 'proj_uth_intro', projectPath, name: 'Dự án thử nghiệm', description: 'Mô tả tiếng Việt', targetPlatform: 'YouTube', targetDuration: 60, aspectRatio: '16:9' }
  const projects = { getDb: async () => db, getProject: async (id) => id === project.id ? project : null }
  const versions = new VersionService(projects)
  const reviews = new ReviewService(projects)
  const service = new ExportService(projects, reviews, versions)
  const source = await versions.createVersion({ projectId: project.id, name: 'Draft V1', versionNumber: 1, videoPath: 'test.mp4', duration: 60, fps: 24 })
  const other = await versions.createVersion({ projectId: project.id, name: 'Draft V2', versionNumber: 2, videoPath: 'test2.mp4', duration: 60, fps: 24 })
  const first = await reviews.createComment({ projectId: project.id, editVersionId: source.id, timestamp: 12.5, category: 'SUBTITLE', priority: 'HIGH', content: 'Di chuyển phụ đề xuống thấp.' })
  const second = await reviews.createComment({ projectId: project.id, editVersionId: source.id, timestamp: 0, frameNumber: 0, category: 'AUDIO', priority: 'MEDIUM', content: 'Giảm âm lượng.' })
  const foreign = await reviews.createComment({ projectId: project.id, editVersionId: other.id, timestamp: 1, category: 'GENERAL', priority: 'LOW', content: 'Other version' })
  const dto = { projectId: project.id, sourceVersionId: source.id, targetVersionName: 'Draft V3', commentIds: [first.id, second.id], instructions: 'Giữ nguyên màu sắc.\nSửa các phản hồi đã chọn.' }
  const attach = (commentId, type, relativePath, bytes = 'fixture image bytes') => {
    const absolute = path.resolve(projectPath, relativePath)
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    fs.writeFileSync(absolute, bytes)
    db.run('INSERT INTO review_attachments (id, review_comment_id, type, file_path, created_at) VALUES (?, ?, ?, ?, ?)', [`${commentId}-${type}`, commentId, type, relativePath, new Date().toISOString()])
    return absolute
  }
  return { service, dto, project, db, directory, first, second, foreign, source, attach,
    reopen: async () => { db.close(); db = new DatabaseManager(dbPath); await db.init(); return db } }
}

test('preview is read-only; export includes only selected reviews, real file sizes and package-relative images', async (t) => {
  const { service, dto, project, db, first, second, attach, reopen } = await fixture(t)
  const original = attach(first.id, 'FRAME', 'frames/source.jpg', Buffer.from([1, 2, 3, 4]))
  const annotated = attach(first.id, 'ANNOTATED_FRAME', 'annotations/source.png', Buffer.from([5, 6, 7]))
  const preview = await service.previewPackage(dto)
  assert.equal(preview.files.length, 5)
  assert.equal(preview.totalBytes, preview.files.reduce((sum, file) => sum + file.size, 0))
  assert.equal(preview.review.reviews[0].id, second.id)
  assert.equal(preview.review.reviews[0].frame, 0)
  assert.equal(preview.review.reviews[1].frameImage, 'frames/0002.jpg')
  assert.equal(preview.warnings.length, 1)
  assert.equal(fs.existsSync(path.join(project.projectPath, 'exports')), false)
  assert.equal(db.get('SELECT COUNT(*) AS count FROM revision_packages').count, 0)
  const result = await service.createPackage(dto)
  const json = JSON.parse(fs.readFileSync(path.join(result.packagePath, 'review.json'), 'utf8'))
  assert.deepEqual(json.reviews.map((item) => item.id), [second.id, first.id])
  assert.equal(json.sourceVersionId, dto.sourceVersionId)
  assert.equal(json.instructions, dto.instructions)
  assert.equal(json.reviews[1].priority, 'high')
  assert.equal(json.reviews[1].status, 'open')
  assert.deepEqual(fs.readFileSync(path.join(result.packagePath, json.reviews[1].frameImage)), fs.readFileSync(original))
  assert.deepEqual(fs.readFileSync(path.join(result.packagePath, json.reviews[1].annotationImage)), fs.readFileSync(annotated))
  for (const file of preview.files) assert.equal(fs.statSync(path.join(result.packagePath, file.path)).size, file.size)
  assert.ok(fs.readFileSync(path.join(result.packagePath, 'instructions.md'), 'utf8').includes(dto.instructions))
  assert.ok(fs.readFileSync(path.join(result.packagePath, 'README.md'), 'utf8').includes('Dự án thử nghiệm'))
  assert.ok(!fs.existsSync(path.join(result.packagePath, 'source_library.json')))
  const reopenedDb = await reopen()
  assert.equal(reopenedDb.get('SELECT package_path FROM revision_packages WHERE id = ?', [result.id]).package_path, result.packagePath)
})

test('repeated and concurrent exports use separate directories without overwriting previous content', async (t) => {
  const { service, dto } = await fixture(t)
  const [first, second] = await Promise.all([service.createPackage(dto), service.createPackage({ ...dto, instructions: 'A different revision' })])
  assert.notEqual(first.packagePath, second.packagePath)
  assert.equal(JSON.parse(fs.readFileSync(path.join(first.packagePath, 'review.json'), 'utf8')).instructions, dto.instructions)
  assert.equal(JSON.parse(fs.readFileSync(path.join(second.packagePath, 'review.json'), 'utf8')).instructions, 'A different revision')
})

test('rejects empty, stale or cross-version selections and invalid target/instructions', async (t) => {
  const { service, dto, foreign, source, project } = await fixture(t)
  for (const change of [
    { commentIds: [] }, { commentIds: ['missing'] }, { commentIds: [foreign.id] },
    { projectId: 'missing' }, { sourceVersionId: 'missing' },
    { targetVersionName: ' ' }, { targetVersionName: source.name }, { targetVersionName: 'x'.repeat(121) },
    { instructions: 'x'.repeat(2001) }
  ]) await assert.rejects(() => service.createPackage({ ...dto, ...change }))
  assert.equal(fs.existsSync(path.join(project.projectPath, 'exports')), false)
})

test('deduplicates IDs and allows explicit export of resolved feedback', async (t) => {
  const { service, dto, db, first } = await fixture(t)
  db.run("UPDATE review_comments SET status = 'FIXED' WHERE id = ?", [first.id])
  const preview = await service.previewPackage({ ...dto, commentIds: [first.id, first.id] })
  assert.equal(preview.review.reviews.length, 1)
  assert.equal(preview.review.reviews[0].status, 'fixed')
})

test('blocks missing media even after a successful preview', async (t) => {
  const { service, dto, first, attach, project } = await fixture(t)
  const file = attach(first.id, 'FRAME', 'frames/source.jpg')
  await service.previewPackage(dto)
  fs.unlinkSync(file)
  await assert.rejects(() => service.createPackage(dto), /thiếu ảnh/)
  assert.equal(fs.existsSync(path.join(project.projectPath, 'exports')), false)
})

test('rejects traversal and absolute paths escaping the project', async (t) => {
  const { service, dto, first, attach, directory, db } = await fixture(t)
  attach(first.id, 'FRAME', '../outside.jpg')
  await assert.rejects(() => service.previewPackage(dto), /ngoài dự án/)
  db.run('UPDATE review_attachments SET file_path = ?', [path.join(directory, 'outside.jpg')])
  await assert.rejects(() => service.createPackage(dto), /ngoài dự án/)
})

test('removes only its own new package when database insert fails', async (t) => {
  const { service, dto, db, project } = await fixture(t)
  const previous = await service.createPackage(dto)
  const before = fs.readFileSync(path.join(previous.packagePath, 'review.json'))
  db.run("CREATE TRIGGER fail_package BEFORE INSERT ON revision_packages BEGIN SELECT RAISE(ABORT, 'test failure'); END")
  await assert.rejects(() => service.createPackage(dto))
  assert.deepEqual(fs.readdirSync(path.join(project.projectPath, 'exports')), [path.basename(previous.packagePath)])
  assert.deepEqual(fs.readFileSync(path.join(previous.packagePath, 'review.json')), before)
  assert.equal(db.get('SELECT COUNT(*) AS count FROM revision_packages').count, 1)
})

test('cleans new files when database persistence fails', async (t) => {
  const { service, dto, db, project } = await fixture(t)
  const persist = db.persist
  db.persist = () => { throw new Error('Disk full') }
  await assert.rejects(() => service.createPackage(dto), /Disk full/)
  db.persist = persist
  assert.equal(db.get('SELECT COUNT(*) AS count FROM revision_packages').count, 0)
  assert.deepEqual(fs.readdirSync(path.join(project.projectPath, 'exports')), [])
})

test('blocks symlink/junction media and export directories that escape the project', async (t) => {
  const { service, dto, directory, project, first, db } = await fixture(t)
  const outside = path.join(directory, 'outside')
  fs.mkdirSync(outside)
  fs.writeFileSync(path.join(outside, 'image.jpg'), 'external image')
  try { fs.symlinkSync(outside, path.join(project.projectPath, 'linked'), process.platform === 'win32' ? 'junction' : 'dir') }
  catch (error) { if (error.code === 'EPERM') { t.skip('Directory symlinks unavailable'); return } throw error }
  db.run('INSERT INTO review_attachments (id, review_comment_id, type, file_path, created_at) VALUES (?, ?, ?, ?, ?)', ['linked', first.id, 'FRAME', 'linked/image.jpg', new Date().toISOString()])
  await assert.rejects(() => service.createPackage(dto), /không hợp lệ/)
  db.run('DELETE FROM review_attachments')
  fs.symlinkSync(outside, path.join(project.projectPath, 'exports'), process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(() => service.createPackage(dto), /exports nằm ngoài/)
  assert.deepEqual(fs.readdirSync(outside), ['image.jpg'])
})

test('does not derive a destination path from untrusted version-number text', async (t) => {
  const { service, dto, db, project } = await fixture(t)
  db.run('UPDATE edit_versions SET version_number = ? WHERE id = ?', ['../../unexpected', dto.sourceVersionId])
  const result = await service.createPackage(dto)
  assert.equal(path.dirname(result.packagePath), path.join(project.projectPath, 'exports'))
  assert.match(path.basename(result.packagePath), /^revision_[0-9A-Z]{26}$/)
})
