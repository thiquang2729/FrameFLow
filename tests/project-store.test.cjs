const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')

function storeFor(api, guard = () => true) {
  const filename = path.resolve(__dirname, '../src/renderer/stores/project.store.ts')
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const module = { exports: {} }
  const nativeRequire = createRequire(filename)
  const requireModule = (name) => name === '../lib/navigation-guard' ? { confirmNavigation: guard } : nativeRequire(name)
  new Function('require', 'module', 'exports', 'window', output)(requireModule, module, module.exports, { api })
  return module.exports.useProjectStore
}
function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

test('latest project selection wins when earlier IPC replies arrive late', async () => {
  const old = deferred()
  const store = storeFor({ getProject: (id) => id === 'old' ? old.promise : Promise.resolve({ id }), getProjectStats: async (id) => ({ sourceCount: id === 'old' ? 99 : 0 }) })
  const oldRequest = store.getState().selectProject('old')
  await store.getState().selectProject('new')
  old.resolve({ id: 'old' })
  await oldRequest
  assert.equal(store.getState().activeProject.id, 'new')
  assert.equal(store.getState().stats.sourceCount, 0)
})

test('stale stats cannot overwrite another project; version/comment targets reset on project change', async () => {
  const slowStats = deferred()
  let slow = false
  const store = storeFor({ getProject: async (id) => ({ id }), getProjectStats: (id) => slow && id === 'first' ? slowStats.promise : Promise.resolve({ sourceCount: id === 'first' ? 1 : 2 }) })
  await store.getState().selectProject('first')
  store.getState().openReview('v1', 'R001')
  assert.equal(store.getState().reviewCommentId, 'R001')
  slow = true
  const request = store.getState().refreshStats()
  await store.getState().selectProject('second')
  slowStats.resolve({ sourceCount: 100 })
  await request
  assert.equal(store.getState().stats.sourceCount, 2)
  assert.equal(store.getState().activeVersionId, null)
  assert.equal(store.getState().reviewCommentId, null)
})

test('a cancelled unsaved-frame guard prevents tab, version and project navigation', async () => {
  let allow = true
  const store = storeFor({ getProject: async (id) => ({ id }), getProjectStats: async () => ({}) }, () => allow)
  await store.getState().selectProject('first')
  store.getState().openReview('v1')
  allow = false
  store.getState().setActiveTab('export')
  assert.equal(store.getState().activeTab, 'review')
  assert.equal(store.getState().selectVersion('v2'), false)
  await store.getState().selectProject('second')
  assert.equal(store.getState().activeProject.id, 'first')
  assert.equal(store.getState().activeVersionId, 'v1')
})
