const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createRequire } = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')

// Exercise the actual TypeScript services without starting an Electron window.
function loadTypeScript(relativePath) {
  const filename = path.resolve(__dirname, '..', relativePath)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', output)(createRequire(filename), module, module.exports)
  return module.exports
}

const { DatabaseManager } = loadTypeScript('src/main/database/db.ts')
const { ReviewService } = loadTypeScript('src/main/services/review.service.ts')

async function fixture(t) {
  const base = process.platform === 'win32' && process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir()
  fs.mkdirSync(base, { recursive: true })
  const directory = fs.mkdtempSync(path.join(base, 'frameflow-review-test-'))
  const dbPath = path.join(directory, 'project.db')
  let db = new DatabaseManager(dbPath)
  t.after(() => { db.close(); fs.rmSync(directory, { recursive: true, force: true }) })
  await db.init()
  for (const [id, projectId, fps] of [['v1', 'proj_uth_intro', 24], ['v2', 'proj_uth_intro', 30], ['foreign', 'proj_riverside', 30]]) {
    db.run(`INSERT INTO edit_versions (id, project_id, version_number, name, video_path, duration, fps, created_at)
      VALUES (?, ?, 1, 'Draft', 'test.mp4', 60, ?, ?)`, [id, projectId, fps, new Date().toISOString()])
  }
  const projects = {
    getDb: async () => db,
    getProject: async (id) => ({ id, projectPath: directory })
  }
  const service = new ReviewService(projects)
  const dto = { projectId: 'proj_uth_intro', editVersionId: 'v1', timestamp: 17.42, category: 'SUBTITLE', priority: 'HIGH', content: '  Move subtitle down  ' }
  return {
    service, dto, db, directory,
    reopen: async () => { db.close(); db = new DatabaseManager(dbPath); await db.init() }
  }
}

test('persists timestamp, content and estimated frame across database reopen; isolates versions', async (t) => {
  const { service, dto, reopen } = await fixture(t)
  const comment = await service.createComment(dto)
  assert.equal(comment.timestamp, 17.42)
  assert.equal(comment.frameNumber, Math.round(17.42 * 24))
  assert.equal(comment.content, 'Move subtitle down')
  await reopen()
  const saved = await service.getComments(dto.projectId, 'v1')
  assert.equal(saved.length, 1)
  assert.equal(saved[0].id, comment.id)
  assert.equal(saved[0].timestamp, 17.42)
  assert.equal((await service.getComments(dto.projectId, 'v2')).length, 0)
})

test('sorts by timestamp and preserves explicit frame zero', async (t) => {
  const { service, dto } = await fixture(t)
  await service.createComment(dto)
  const first = await service.createComment({ ...dto, timestamp: 0, frameNumber: 0 })
  assert.equal(first.frameNumber, 0)
  assert.deepEqual((await service.getComments(dto.projectId, 'v1')).map((item) => item.timestamp), [0, 17.42])
})

test('generates non-colliding IDs after a comment is deleted', async (t) => {
  const { service, dto } = await fixture(t)
  const first = await service.createComment(dto)
  const second = await service.createComment(dto)
  await service.deleteComment(dto.projectId, first.id)
  const third = await service.createComment(dto)
  assert.notEqual(third.id, second.id)
  assert.equal((await service.getComments(dto.projectId, 'v1')).length, 2)
})

test('rejects invalid timestamps, frames, content, enums and mismatched version ownership', async (t) => {
  const { service, dto } = await fixture(t)
  for (const change of [
    { timestamp: -1 }, { timestamp: NaN }, { timestamp: Infinity }, { timestamp: 61 },
    { frameNumber: -1 }, { frameNumber: 0.5 }, { content: '   ' },
    { category: 'INVALID' }, { priority: 'INVALID' }, { editVersionId: 'foreign' }
  ]) await assert.rejects(() => service.createComment({ ...dto, ...change }))
  assert.equal((await service.getComments(dto.projectId, 'v1')).length, 0)
})

test('persists status changes and prevents updates from another project', async (t) => {
  const { service, dto, reopen } = await fixture(t)
  const comment = await service.createComment(dto)
  const update = { projectId: dto.projectId, commentId: comment.id, status: 'FIXED' }
  await service.updateStatus(update)
  await reopen()
  let saved = (await service.getComments(dto.projectId, 'v1'))[0]
  assert.equal(saved.status, 'FIXED')
  assert.ok(saved.resolvedAt)
  await assert.rejects(() => service.updateStatus({ ...update, projectId: 'proj_riverside' }))
  await assert.rejects(() => service.updateStatus({ ...update, status: 'INVALID' }))
  await service.updateStatus({ ...update, status: 'OPEN' })
  saved = (await service.getComments(dto.projectId, 'v1'))[0]
  assert.equal(saved.status, 'OPEN')
  assert.equal(saved.resolvedAt, null)
})

// Service tests verify byte preservation, not browser image decoding.
const frameBase64 = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]).toString('base64')}`
const annotatedFrameBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg=='
const annotation = {
  id: 'draft-shape', reviewCommentId: '', type: 'ARROW', createdAt: '2026-10-27',
  data: { type: 'ARROW', color: '#ef4444', strokeWidth: 4, points: [0.1, 0.2, 0.8, 0.7] }
}

test('saves original JPEG, separate annotated PNG and all shape JSON across reopen', async (t) => {
  const { service, dto, directory, reopen } = await fixture(t)
  const shapes = [annotation,
    { ...annotation, type: 'RECT', data: { type: 'RECT', color: '#2563eb', strokeWidth: 2, x: 0.1, y: 0.2, width: 0.5, height: 0.3 } },
    { ...annotation, type: 'CIRCLE', data: { type: 'CIRCLE', color: '#10b981', strokeWidth: 6, x: 0.2, y: 0.3, width: 0.4, height: 0.4 } },
    { ...annotation, type: 'TEXT', data: { type: 'TEXT', color: '#ffffff', strokeWidth: 4, x: 0.1, y: 0.1, text: 'Di chuyển phụ đề', fontSize: 24 } }
  ]
  const comment = await service.createComment({ ...dto, frameBase64, annotatedFrameBase64, annotations: shapes })
  await reopen()
  const saved = (await service.getComments(dto.projectId, dto.editVersionId))[0]
  assert.equal(saved.id, comment.id)
  assert.deepEqual(saved.annotations.map((item) => item.data), shapes.map((item) => item.data))
  assert.ok(saved.annotations.every((item) => item.reviewCommentId === saved.id))
  assert.deepEqual(saved.attachments.map((item) => item.type).sort(), ['ANNOTATED_FRAME', 'FRAME'])
  for (const attachment of saved.attachments) {
    const expected = attachment.type === 'FRAME' ? frameBase64 : annotatedFrameBase64
    assert.deepEqual(fs.readFileSync(path.join(directory, attachment.filePath)), Buffer.from(expected.split(',')[1], 'base64'))
  }
})

test('rolls back database and removes newly written images when annotation insert fails', async (t) => {
  const { service, dto, db, directory, reopen } = await fixture(t)
  db.run("CREATE TRIGGER fail_annotation BEFORE INSERT ON annotations BEGIN SELECT RAISE(ABORT, 'test failure'); END")
  await assert.rejects(() => service.createComment({ ...dto, frameBase64, annotatedFrameBase64, annotations: [annotation] }))
  assert.equal(db.get('SELECT COUNT(*) AS count FROM review_comments').count, 0)
  assert.equal(db.get('SELECT COUNT(*) AS count FROM review_attachments').count, 0)
  assert.deepEqual(fs.readdirSync(path.join(directory, 'frames')), [])
  assert.deepEqual(fs.readdirSync(path.join(directory, 'annotations')), [])
  await reopen()
  assert.equal((await service.getComments(dto.projectId, dto.editVersionId)).length, 0)
})

test('does not leave partial comments on image errors and rejects malformed shapes', async (t) => {
  const { service, dto, directory } = await fixture(t)
  await assert.rejects(() => service.createComment({ ...dto, frameBase64, annotatedFrameBase64: 'invalid' }))
  assert.equal((await service.getComments(dto.projectId, dto.editVersionId)).length, 0)
  assert.deepEqual(fs.readdirSync(path.join(directory, 'frames')), [])
  for (const data of [
    { ...annotation.data, points: [0, 0, 2, 1] },
    { ...annotation.data, strokeWidth: -1 },
    { ...annotation.data, type: 'TEXT' }
  ]) await assert.rejects(() => service.createComment({ ...dto, frameBase64, annotatedFrameBase64, annotations: [{ ...annotation, data }] }))
  await assert.rejects(() => service.createComment({ ...dto, annotations: [annotation] }))
})

test('transaction restores memory and disk when database persistence fails', async (t) => {
  const { service, dto, db, reopen } = await fixture(t)
  const persist = db.persist
  db.persist = () => { throw new Error('Disk full') }
  await assert.rejects(() => service.createComment(dto), /Disk full/)
  db.persist = persist
  assert.equal((await service.getComments(dto.projectId, dto.editVersionId)).length, 0)
  await reopen()
  assert.equal((await service.getComments(dto.projectId, dto.editVersionId)).length, 0)
})
