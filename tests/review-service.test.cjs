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
    service, dto, db,
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
