const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createRequire } = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')
const cache = new Map()
function load(relativePath) {
  const filename = path.resolve(__dirname, '..', relativePath)
  if (cache.has(filename)) return cache.get(filename).exports
  const module = { exports: {} }
  cache.set(filename, module)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText
  const nativeRequire = createRequire(filename)
  const requireModule = (name) => {
    if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), `${name}.ts`))
    return nativeRequire(name)
  }
  new Function('require', 'module', 'exports', output)(requireModule, module, module.exports)
  return module.exports
}
const { ProjectService } = load('src/main/services/project.service.ts')
const { VersionService } = load('src/main/services/version.service.ts')
const { ReviewService } = load('src/main/services/review.service.ts')

async function fixture(t) {
  const base = process.platform === 'win32' && process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir()
  fs.mkdirSync(base, { recursive: true })
  const directory = fs.mkdtempSync(path.join(base, 'frameflow-project-test-'))
  const projects = new ProjectService(path.join(directory, 'registry'))
  const owned = []
  t.after(async () => {
    for (const project of owned) (await projects.getDb(project.id)).close()
    fs.rmSync(directory, { recursive: true, force: true })
  })
  const create = async (name = 'Dự án thử nghiệm') => {
    const project = await projects.createProject({ name, projectDir: directory })
    owned.push(project)
    return project
  }
  const videoPath = path.join(directory, 'video #1.webm')
  fs.writeFileSync(videoPath, 'backend validates file existence, not codec')
  return { projects, create, directory, videoPath, versions: new VersionService(projects), reviews: new ReviewService(projects) }
}

test('new projects contain no sample rows; identical names own different folders/databases', async (t) => {
  const { create, projects } = await fixture(t)
  const first = await create('Dự án / giống nhau')
  const second = await create('Dự án / giống nhau')
  assert.notEqual(first.projectPath, second.projectPath)
  assert.equal(first.name, 'Dự án / giống nhau')
  for (const project of [first, second]) {
    const db = await projects.getDb(project.id)
    assert.equal(db.get('SELECT COUNT(*) AS count FROM projects').count, 1)
    assert.deepEqual(await projects.getProjectStats(project.id), { sourceCount: 0, versionCount: 0, openReviewCount: 0, highPriorityCount: 0 })
  }
})

test('concurrent cold database loads share one connection and do not lose writes', async (t) => {
  const { create, projects, directory } = await fixture(t)
  const project = await create()
  const cold = new ProjectService(path.join(directory, 'registry'))
  const [first, second] = await Promise.all([cold.getDb(project.id), cold.getDb(project.id)])
  assert.equal(first, second)
  first.run('UPDATE projects SET description = ? WHERE id = ?', ['saved through shared connection', project.id])
  assert.equal(second.get('SELECT description FROM projects WHERE id = ?', [project.id]).description, 'saved through shared connection')
  first.close()
})

test('stats scope project IDs and count unresolved HIGH/CRITICAL including partial/in-progress', async (t) => {
  const { create, projects, versions, reviews, videoPath } = await fixture(t)
  const project = await create()
  const version = await versions.createVersion({ projectId: project.id, name: 'Draft', versionNumber: 1, videoPath, fps: 24 })
  for (const [index, status] of ['OPEN', 'IN_PROGRESS', 'PARTIAL', 'FIXED', 'REJECTED'].entries()) {
    const comment = await reviews.createComment({ projectId: project.id, editVersionId: version.id, timestamp: index, category: 'GENERAL', priority: 'CRITICAL', content: status })
    await reviews.updateStatus({ projectId: project.id, commentId: comment.id, status })
  }
  const db = await projects.getDb(project.id)
  db.run("INSERT INTO source_assets (id, project_id, original_path, filename, imported_at) VALUES ('foreign-source', 'other-project', 'test', 'test', 'now')")
  db.run("INSERT INTO edit_versions (id, project_id, version_number, name, video_path, created_at) VALUES ('foreign-version', 'other-project', 1, 'foreign', 'test', 'now')")
  db.run("INSERT INTO review_comments (id, project_id, edit_version_id, timestamp, category, priority, content, status, created_at) VALUES ('foreign-review', 'other-project', 'foreign-version', 0, 'GENERAL', 'HIGH', 'foreign', 'OPEN', 'now')")
  const stats = await projects.getProjectStats(project.id)
  assert.equal(stats.sourceCount, 0)
  assert.equal(stats.openReviewCount, 3)
  assert.equal(stats.highPriorityCount, 3)
  assert.equal(stats.versionCount, 1)
})

test('versions persist real paths and lineage without invented FPS/resolution', async (t) => {
  const { create, projects, versions, videoPath } = await fixture(t)
  const project = await create()
  const parent = await versions.createVersion({ projectId: project.id, name: ' First ', versionNumber: 1, videoPath })
  const child = await versions.createVersion({ projectId: project.id, name: 'Second', versionNumber: 3, videoPath, parentVersionId: parent.id, fps: 23.976 })
  assert.equal(parent.name, 'First')
  assert.equal(parent.width, undefined)
  assert.equal(parent.fps, undefined)
  assert.equal(child.parentVersionId, parent.id)
  assert.equal(child.videoPath, fs.realpathSync(videoPath))
  assert.equal((await versions.getVersions(project.id))[1].versionNumber, 3)
  assert.equal((await projects.getProjectStats(project.id)).versionCount, 2)
})

test('rejects duplicate version numbers, invalid parent ownership, invalid metadata and missing files', async (t) => {
  const { create, versions, videoPath, directory } = await fixture(t)
  const project = await create()
  const other = await create('Other')
  const parent = await versions.createVersion({ projectId: other.id, name: 'Other', versionNumber: 1, videoPath })
  const dto = { projectId: project.id, name: 'Draft', versionNumber: 1, videoPath }
  for (const change of [
    { versionNumber: 0 }, { versionNumber: 1.5 }, { name: ' ' }, { parentVersionId: parent.id },
    { videoPath: path.join(directory, 'missing.mp4') }, { videoPath: 'relative.mp4' }, { fps: NaN }, { width: -1 }, { duration: Infinity }
  ]) await assert.rejects(() => versions.createVersion({ ...dto, ...change }))
  const [first, second] = await Promise.allSettled([versions.createVersion(dto), versions.createVersion(dto)])
  assert.equal([first, second].filter((result) => result.status === 'fulfilled').length, 1)
})
