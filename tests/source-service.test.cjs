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
  const localRequire = createRequire(filename)
  const requireModule = (name) => name === '@shared/media' ? load('src/shared/media.ts') : localRequire(name)
  new Function('require', 'module', 'exports', output)(requireModule, module, module.exports)
  return module.exports
}
const { DatabaseManager } = load('src/main/database/db.ts')
const { SourceService } = load('src/main/services/source.service.ts')
const thumbnailBase64 = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]).toString('base64')}`

async function fixture(t) {
  const base = process.platform === 'win32' && process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir()
  fs.mkdirSync(base, { recursive: true })
  const directory = fs.mkdtempSync(path.join(base, 'frameflow-source-test-'))
  const projectPath = path.join(directory, 'project')
  let db = new DatabaseManager(path.join(projectPath, 'project.db'))
  await db.init()
  t.after(() => { db.close(); fs.rmSync(directory, { recursive: true, force: true }) })
  const filePath = path.join(directory, 'source #1.webm')
  fs.writeFileSync(filePath, 'source bytes')
  const service = new SourceService({
    getDb: async () => db,
    getProject: async (id) => id === 'missing' ? null : ({ id, projectPath })
  })
  const dto = { projectId: 'proj_uth_intro', filePath, filename: 'fake-name', fileSize: 9999 }
  return { service, dto, db, directory, projectPath, reopen: async () => { db.close(); db = new DatabaseManager(path.join(projectPath, 'project.db')); await db.init() } }
}

test('imports path references with actual name/size, unknown FPS/codec and persistent thumbnail', async (t) => {
  const { service, dto, directory, projectPath, reopen } = await fixture(t)
  const asset = await service.importSource({ ...dto, width: 360, height: 640, duration: 12.5, thumbnailBase64 })
  assert.equal(asset.filename, 'source #1.webm')
  assert.equal(asset.fileSize, Buffer.byteLength('source bytes'))
  assert.equal(asset.fps, undefined)
  assert.equal(asset.codec, undefined)
  assert.equal(asset.originalPath, fs.realpathSync(dto.filePath))
  assert.equal(fs.existsSync(path.join(projectPath, 'source', asset.filename)), false)
  await reopen()
  const saved = (await service.getSources(dto.projectId))[0]
  assert.equal(saved.width, 360)
  assert.equal(saved.duration, 12.5)
  assert.equal(saved.thumbnailPath, asset.thumbnailPath)
  assert.equal(saved.codec, undefined)
  assert.ok(fs.existsSync(path.join(projectPath, saved.thumbnailPath)))
  assert.ok(fs.existsSync(path.join(directory, 'source #1.webm')))
})

test('deduplicates repeated and concurrent imports by canonical path per project', async (t) => {
  const { service, dto } = await fixture(t)
  const [first, second] = await Promise.all([service.importSource(dto), service.importSource(dto)])
  assert.equal(first.id, second.id)
  assert.equal((await service.importSource({ ...dto, filePath: path.join(path.dirname(dto.filePath), '.', path.basename(dto.filePath)) })).id, first.id)
  assert.equal((await service.getSources(dto.projectId)).length, 1)
  await service.importSource({ ...dto, projectId: 'proj_riverside' })
  assert.equal((await service.getSources('proj_riverside')).length, 1)
})

test('unknown media metadata stays absent instead of becoming 1080p/30fps/H264', async (t) => {
  const { service, dto } = await fixture(t)
  await service.importSource(dto)
  const saved = (await service.getSources(dto.projectId))[0]
  for (const field of ['width', 'height', 'duration', 'fps', 'codec']) assert.equal(saved[field], undefined)
})

test('rejects missing/unsupported files, invalid metadata and invalid project', async (t) => {
  const { service, dto, directory } = await fixture(t)
  fs.writeFileSync(path.join(directory, 'unsupported.txt'), 'not media')
  for (const change of [
    { filePath: path.join(directory, 'missing.webm') }, { filePath: 'relative.webm' },
    { filePath: path.join(directory, 'unsupported.txt') }, { projectId: 'missing' },
    { width: -1 }, { height: 1.5 }, { fps: NaN }, { duration: Infinity }
  ]) await assert.rejects(() => service.importSource({ ...dto, ...change }))
  assert.equal((await service.getSources(dto.projectId)).length, 0)
})

test('recursively scans supported files only, including nested footage', async (t) => {
  const { service, directory } = await fixture(t)
  const folder = path.join(directory, 'footage')
  fs.mkdirSync(path.join(folder, 'nested'), { recursive: true })
  for (const name of ['clip.MP4', 'nested/photo.jpg', 'nested/movie.webm', 'ignore.txt']) fs.writeFileSync(path.join(folder, name), 'fixture')
  const files = await service.scanDirectory(folder)
  assert.equal(files.length, 3)
  assert.ok(files.includes(path.join(folder, 'nested', 'movie.webm')))
  assert.ok(files.every((file) => !file.endsWith('.txt')))
  await assert.rejects(() => service.scanDirectory(path.join(folder, 'missing')))
})

test('rolls back row and thumbnail after a database insert failure', async (t) => {
  const { service, dto, db, projectPath } = await fixture(t)
  db.run("CREATE TRIGGER fail_source BEFORE INSERT ON source_assets BEGIN SELECT RAISE(ABORT, 'test error'); END")
  await assert.rejects(() => service.importSource({ ...dto, thumbnailBase64 }))
  assert.equal((await service.getSources(dto.projectId)).length, 0)
  assert.deepEqual(fs.readdirSync(path.join(projectPath, 'thumbnails')), [])
})

test('additive thumbnail migration preserves existing source rows', async (t) => {
  const { service, dto, db, reopen } = await fixture(t)
  const asset = await service.importSource(dto)
  db.run('ALTER TABLE source_assets DROP COLUMN thumbnail_path')
  await reopen()
  const saved = (await service.getSources(dto.projectId))[0]
  assert.equal(saved.id, asset.id)
  assert.equal(saved.originalPath, asset.originalPath)
  assert.equal(saved.thumbnailPath, null)
  await reopen()
  assert.equal((await service.getSources(dto.projectId))[0].id, asset.id)
})
