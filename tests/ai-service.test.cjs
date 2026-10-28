const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const { createRequire } = require('node:module')
const { spawn } = require('node:child_process')
const { test } = require('node:test')
const ts = require('typescript')

const filename = path.resolve(__dirname, '../src/main/services/ai.service.ts')
const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText
const loaded = { exports: {} }
new Function('require', 'module', 'exports', output)(createRequire(filename), loaded, loaded.exports)
const { AiService, freeLocalPort } = loaded.exports
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const folder = `${process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux'}-${process.arch}`
const binaryDir = path.resolve(__dirname, '../resources/cli-proxy', folder)
const supervisor = path.resolve(__dirname, '../resources/proxy-supervisor.cjs')

function fixture(t, overrides = {}) {
  const base = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir()
  fs.mkdirSync(base, { recursive: true })
  const root = fs.mkdtempSync(path.join(base, 'frameflow-ai-test-'))
  const service = new AiService({ dataDir: root, binaryDir, supervisorPath: supervisor, nodePath: process.execPath, openExternal: async () => {}, ...overrides })
  t.after(async () => { await service.stop(); fs.rmSync(root, { recursive: true, force: true }) })
  return { service, root }
}

test('missing or modified bundled proxy fails safely without affecting projects', async (t) => {
  const { service, root } = fixture(t, { binaryDir: path.join(os.tmpdir(), 'missing-frameflow-proxy') })
  const status = await service.start()
  assert.equal(status.state, 'error')
  assert.match(status.message, /Thiếu CLIProxyAPI/)
  assert.equal(status.endpoint, null)
  assert.equal(fs.existsSync(path.join(root, 'runtime.yaml')), false)
})

test('input validation, model persistence, response parsing and private error messages', async (t) => {
  const { service, root } = fixture(t)
  let mode = 'ok'
  const requests = []
  const server = http.createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    requests.push({ url: req.url, authorization: req.headers.authorization, body: chunks.length ? JSON.parse(Buffer.concat(chunks)) : null })
    res.setHeader('content-type', 'application/json')
    if (req.url.endsWith('/models')) return res.end(JSON.stringify({ data: [{ id: 'test-model' }, { id: 'test-model' }, { id: 123 }] }))
    if (mode === 'error') { res.statusCode = 429; return res.end(JSON.stringify({ secret: 'upstream-token-must-not-leak' })) }
    if (mode === 'invalid') return res.end('not-json')
    if (mode === 'empty') return res.end(JSON.stringify({ choices: [] }))
    if (mode === 'slow') return
    res.end(JSON.stringify({ choices: [{ message: { content: 'Kết nối thành công' } }] }))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  service.status.state = 'ready'
  service.status.endpoint = `http://127.0.0.1:${server.address().port}/v1`
  service.key = 'private-client-key'
  assert.deepEqual(await service.listModels(), ['test-model'])
  await assert.rejects(service.testPrompt('test-model', ''), /8.000/)
  await assert.rejects(service.testPrompt('unknown', 'hello'), /Model không khả dụng/)
  await assert.rejects(service.selectModel('../bad'), /danh sách/)
  await service.selectModel('test-model')
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'settings.json'))), { selectedModel: 'test-model' })
  const answer = await service.testPrompt('test-model', '  hello  ')
  assert.equal(answer.text, 'Kết nối thành công')
  const completion = requests.find((req) => req.url.endsWith('/chat/completions'))
  assert.equal(completion.authorization, 'Bearer private-client-key')
  assert.deepEqual(completion.body.messages, [{ role: 'user', content: 'hello' }])
  assert.equal(JSON.stringify(service.getStatus()).includes('private-client-key'), false)
  mode = 'error'
  await assert.rejects(service.testPrompt('test-model', 'hello'), (err) => /giới hạn/.test(err.message) && !err.message.includes('upstream-token'))
  mode = 'invalid'
  await assert.rejects(service.testPrompt('test-model', 'hello'), /không hợp lệ/)
  mode = 'empty'
  await assert.rejects(service.testPrompt('test-model', 'hello'), /không trả lời/)
  mode = 'slow'
  const slow = service.testPrompt('test-model', 'hello')
  while (!service.testController) await delay(10)
  await assert.rejects(service.testPrompt('test-model', 'another'), /Đang có/)
  service.cancelTest()
  await assert.rejects(slow, /đã bị hủy/)
})

test('real bundled proxy auto-starts, uses loopback and a private key, restarts and cleans up', { skip: !fs.existsSync(path.join(binaryDir, 'manifest.json')), timeout: 90000 }, async (t) => {
  const { service, root } = fixture(t)
  const [first, same] = await Promise.all([service.start(), service.start()])
  assert.equal(first.state, 'ready', first.message)
  assert.equal(same.pid, first.pid)
  assert.ok(first.pid > 0)
  assert.match(first.endpoint, /^http:\/\/127\.0\.0\.1:\d+\/v1$/)
  const config = JSON.parse(fs.readFileSync(path.join(root, 'runtime.yaml')))
  assert.equal(config.server.host, '127.0.0.1')
  assert.equal(config.management['secret-key'], '')
  assert.equal(config.oauth['auth-dir'], path.join(root, 'auth'))
  assert.equal((await fetch(first.endpoint + '/models')).status, 401)
  assert.equal((await fetch(first.endpoint + '/models', { headers: { Authorization: 'Bearer wrong' } })).status, 401)
  assert.deepEqual(await service.listModels(), [])
  const key = config.access['api-keys'][0]
  assert.equal(JSON.stringify(first).includes(key), false)
  const [next, concurrent] = await Promise.all([service.restart(), service.restart()])
  assert.equal(next.pid, concurrent.pid)
  assert.equal(next.state, 'ready', next.message)
  assert.notEqual(next.pid, first.pid)
  assert.notEqual(JSON.parse(fs.readFileSync(path.join(root, 'runtime.yaml'))).access['api-keys'][0], key)
  await service.stop()
  assert.equal(service.getStatus().state, 'stopped')
  assert.equal(fs.existsSync(path.join(root, 'runtime.yaml')), false)
  await assert.rejects(fetch(next.endpoint + '/models'))
  assert.throws(() => process.kill(next.pid, 0))
})

test('OAuth opens only the Google URL, does not expose tokens and can be cancelled', { skip: !fs.existsSync(path.join(binaryDir, 'manifest.json')), timeout: 45000 }, async (t) => {
  let opened
  const { service } = fixture(t, { openExternal: async (url) => { opened = url } })
  assert.equal((await service.start()).state, 'ready')
  const status = await service.login()
  assert.equal(status.login, 'waiting')
  const deadline = Date.now() + 12000
  while (!opened && Date.now() < deadline) await delay(100)
  assert.ok(opened, 'real CLI prints a complete browser login URL')
  const url = new URL(opened)
  assert.equal(url.hostname, 'accounts.google.com')
  assert.equal(url.protocol, 'https:')
  const redirect = new URL(url.searchParams.get('redirect_uri'))
  assert.equal(redirect.hostname, 'localhost')
  assert.ok(redirect.port)
  assert.equal(JSON.stringify(service.getStatus()).includes(url.searchParams.get('state')), false)
  service.cancelLogin()
  assert.equal(service.getStatus().login, 'idle')
  await delay(500)
  await assert.rejects(fetch(redirect.href))
})

test('watchdog kills only owned proxy when its parent pipe closes', { skip: !fs.existsSync(path.join(binaryDir, 'manifest.json')), timeout: 45000 }, async (t) => {
  const { root } = fixture(t)
  const port = await freeLocalPort()
  const config = path.join(root, 'test-config.yaml')
  fs.writeFileSync(config, JSON.stringify({ 'config-version': 8, server: { host: '127.0.0.1', port }, access: { 'api-keys': ['watchdog-test-key'] }, oauth: { 'auth-dir': path.join(root, 'auth') }, management: { 'disable-control-panel': true }, plugins: { enabled: false } }))
  const binary = path.join(binaryDir, process.platform === 'win32' ? 'cli-proxy-api.exe' : 'cli-proxy-api')
  const child = spawn(process.execPath, [supervisor, binary, config, 'server'], { stdio: ['pipe', 'pipe', 'pipe'] })
  t.after(() => { if (child.exitCode === null) child.stdin.end() })
  const pid = await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error('watchdog spawn timed out')), 10000)
    child.stdout.on('data', (chunk) => {
      output += chunk
      for (const line of output.split('\n').slice(0, -1)) {
        const event = JSON.parse(line)
        if (event.type === 'spawn') { clearTimeout(timer); resolve(event.pid) }
      }
    })
    child.on('error', reject)
  })
  const exited = new Promise((resolve) => child.once('exit', resolve))
  child.stdin.end()
  await exited
  assert.throws(() => process.kill(pid, 0))
})
