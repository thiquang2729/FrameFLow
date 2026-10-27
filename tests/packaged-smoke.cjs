// Tests the actual unpacked executable through localhost DevTools Protocol.
// No test hooks or remote-debugging settings are added to the application.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')
const { spawn, execFileSync } = require('node:child_process')

if (process.platform !== 'win32') throw new Error('This smoke test currently targets the Windows unpacked build.')
if (typeof WebSocket !== 'function') throw new Error('Node.js 22+ is required for the packaged smoke test.')
const executable = path.resolve(process.argv[2] || 'release/win-unpacked/FrameFlow.exe')
if (!fs.existsSync(executable)) throw new Error('Run pnpm build:unpack before pnpm test:packaged.')
const base = path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode')
fs.mkdirSync(base, { recursive: true })
const root = fs.mkdtempSync(path.join(base, 'frameflow-packaged-'))
const home = path.join(root, 'home')
fs.mkdirSync(home)
const env = { ...process.env, USERPROFILE: home, HOME: home }
delete env.ELECTRON_RUN_AS_NODE
delete env.ELECTRON_RENDERER_URL
assert.equal(execFileSync(process.execPath, ['-e', "process.stdout.write(require('os').homedir())"], { env, encoding: 'utf8' }), home)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let child
let socket
let serial = 0
const pending = new Map()
const runtimeErrors = []
const notes = []
const cases = []

function send(method, params = {}) {
  const id = ++serial
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 30000)
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value) }, reject: (error) => { clearTimeout(timer); reject(error) } })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result.value
}

async function waitFor(expression, label, timeout = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try { if (await evaluate(expression)) return }
    catch (error) { if (!/Execution context was destroyed|Cannot find context|Inspected target navigated/.test(error.message)) throw error }
    await delay(80)
  }
  throw new Error(`Timeout: ${label}`)
}

async function freePort() {
  const server = net.createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}

async function launch() {
  const port = await freePort()
  child = spawn(executable, [
    `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${path.join(root, 'electron-profile')}`, `--disk-cache-dir=${path.join(root, 'cache')}`
  ], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.on('error', (error) => notes.push(error.message))
  child.stdout.on('data', (data) => fs.appendFileSync(path.join(root, 'runtime.log'), data))
  child.stderr.on('data', (data) => fs.appendFileSync(path.join(root, 'runtime.log'), data))
  let target
  const start = Date.now()
  while (Date.now() - start < 20000) {
    if (child.exitCode !== null) throw new Error(`Packaged app exited early (${child.exitCode}); see ${root}/runtime.log`)
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())
      target = targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl)
      if (target) break
    } catch { /* The app may still be starting. */ }
    await delay(100)
  }
  if (!target) throw new Error('Packaged app did not expose its test page; inspect runtime.log.')
  assert.ok(target.url.includes('app.asar'), 'the smoke test targets packaged resources, not a dev server')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) request.reject(new Error(JSON.stringify(message.error)))
      else request.resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text)
  })
  socket.addEventListener('close', () => {
    for (const request of pending.values()) request.reject(new Error('Test target closed'))
    pending.clear()
  })
  await send('Runtime.enable')
  await waitFor('Boolean(window.api && document.querySelector("nav"))', 'packaged preload and renderer')
  assert.ok(fs.existsSync(path.join(home, '.frameflow', 'projects.json')), 'test registry is isolated from real user data')
}

async function close() {
  if (!child) return
  const current = child
  const exited = new Promise((resolve) => current.once('exit', resolve))
  // Closing the app may destroy its target before an evaluation reply arrives.
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ id: ++serial, method: 'Runtime.evaluate', params: { expression: 'window.close()' } }))
  await Promise.race([exited, delay(5000)])
  if (current.exitCode === null) { current.kill(); await Promise.race([exited, delay(3000)]) }
  if (socket) socket.close()
  child = null
  socket = null
}

async function record(width, height, mimeType) {
  return evaluate(`(async () => {
    if (!MediaRecorder.isTypeSupported(${JSON.stringify(mimeType)})) return { supported: false };
    const canvas = document.createElement('canvas'); canvas.width = ${width}; canvas.height = ${height};
    const ctx = canvas.getContext('2d');
    const paint = () => { ctx.fillStyle = '#123456'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle = '#22c55e'; ctx.fillRect(canvas.width*.1,canvas.height*.1,canvas.width*.3,canvas.height*.3); ctx.fillStyle = '#fff'; ctx.font = '48px sans-serif'; ctx.fillText('Packaged codec test',20,canvas.height-50); };
    paint(); const stream = canvas.captureStream(10); const recorder = new MediaRecorder(stream, { mimeType: ${JSON.stringify(mimeType)} });
    const chunks = [];
    const finished = new Promise((resolve, reject) => { recorder.onerror = (event) => reject(new Error(event.error?.message || 'Recorder error')); recorder.ondataavailable = (event) => chunks.push(event.data); recorder.onstop = () => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(new Blob(chunks, { type: recorder.mimeType })); }; });
    recorder.start(); const timer = setInterval(paint,100); await new Promise((resolve) => setTimeout(resolve,1600)); recorder.stop(); clearInterval(timer); stream.getTracks().forEach((track) => track.stop());
    return { supported: true, mimeType: recorder.mimeType, data: await finished };
  })()`)
}

async function click(text) {
  assert.ok(await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === ${JSON.stringify(text)}); if (!button || button.disabled) return false; button.click(); return true; })()`), `Available button: ${text}`)
  await delay(100)
}

async function exercise(project, version, width, height, mimeType) {
  await click('Duyệt')
  await waitFor(`Boolean(document.querySelector('select[aria-label="Phiên bản đang duyệt"]'))`, 'version selector')
  await evaluate(`(() => { const input = document.querySelector('select[aria-label="Phiên bản đang duyệt"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(input,${JSON.stringify(version.id)}); input.dispatchEvent(new Event('change',{bubbles:true})); })()`)
  await waitFor(`document.querySelector('video')?.videoWidth === ${width} && document.querySelector('video').readyState >= 2`, 'real codec playback frame')
  assert.equal(await evaluate(`document.querySelector('video').videoHeight`), height)
  await evaluate(`document.querySelector('video').play()`)
  await waitFor(`document.querySelector('video').currentTime > .2`, 'video plays')
  await evaluate(`document.querySelector('video').pause()`)
  await click('Thêm bình luận (C)')
  await waitFor(`document.querySelector('canvas')?.width === ${width} && !document.body.textContent.includes('Đang tải frame...')`, 'source-resolution capture')
  assert.equal(await evaluate(`document.querySelector('canvas').height`), height)
  await evaluate(`(() => { const input = document.querySelector('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Packaged ${width}x${height} codec review'); input.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('canvas').scrollIntoView({block:'center'}); })()`)
  const rect = await evaluate(`(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()`)
  assert.ok(Math.abs(rect.width / rect.height - width / height) < 0.02, 'preview preserves aspect ratio')
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x + rect.width * .2, y: rect.y + rect.height * .2, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x + rect.width * .7, y: rect.y + rect.height * .6, button: 'left', buttons: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x + rect.width * .7, y: rect.y + rect.height * .6, button: 'left', clickCount: 1 })
  await delay(100)
  await click('Lưu bình luận')
  await waitFor('!document.querySelector("textarea")', 'packaged review saves through SQLite')
  const comments = await evaluate(`window.api.listComments(${JSON.stringify(project.id)},${JSON.stringify(version.id)})`)
  assert.equal(comments.length, 1)
  assert.equal(comments[0].annotations.length, 1)
  const result = await evaluate(`window.api.createPackage({ projectId:${JSON.stringify(project.id)}, sourceVersionId:${JSON.stringify(version.id)},targetVersionName:'Next draft',commentIds:[${JSON.stringify(comments[0].id)}],instructions:'Keep original footage unchanged.' })`)
  const review = JSON.parse(fs.readFileSync(path.join(result.packagePath, 'review.json'), 'utf8'))
  const png = fs.readFileSync(path.join(result.packagePath, review.reviews[0].annotationImage))
  assert.equal(png.readUInt32BE(16), width)
  assert.equal(png.readUInt32BE(20), height)
  assert.ok(fs.existsSync(path.join(result.packagePath, review.reviews[0].frameImage)))
  const screenshot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(root, `review-${width}x${height}.png`), Buffer.from(screenshot.data, 'base64'))
  cases.push({ versionId: version.id, width, height, mimeType, packagePath: result.packagePath })
}

async function run() {
  await launch()
  const project = await evaluate(`window.api.createProject({ name:'Packaged smoke',projectDir:${JSON.stringify(root)},aspectRatio:'16:9' })`)
  assert.ok(project.projectPath.startsWith(root + path.sep))
  let number = 0
  for (const [width, height, mimeType, extension] of [
    [3840, 2160, 'video/webm;codecs=vp8', 'webm'],
    [640, 360, 'video/mp4;codecs=avc1.42E01E', 'mp4']
  ]) {
    let recorded
    try { recorded = await record(width, height, mimeType) }
    catch (error) {
      if (extension !== 'mp4') throw error
      notes.push(`MP4 fixture encoding failed: ${error.message}; H.264 playback was not tested.`)
      continue
    }
    if (!recorded.supported) { notes.push(`Encoder unavailable: ${mimeType}; this codec case was not tested.`); continue }
    const videoPath = path.join(root, `codec-${width}x${height}.${extension}`)
    const encoded = Buffer.from(recorded.data.split(',')[1], 'base64')
    assert.ok(encoded.includes(Buffer.from(extension === 'mp4' ? 'avc1' : 'V_VP8')), 'fixture container identifies the intended codec')
    fs.writeFileSync(videoPath, encoded)
    const version = await evaluate(`window.api.createVersion({projectId:${JSON.stringify(project.id)},versionNumber:${++number},name:'Codec ${width}x${height}',videoPath:${JSON.stringify(videoPath)},width:${width},height:${height},fps:10})`)
    await send('Page.reload')
    await waitFor(`document.body?.textContent?.includes('Packaged smoke') && Boolean(window.api)`, 'project after packaged reload')
    await exercise(project, version, width, height, recorded.mimeType)
  }
  assert.ok(cases.some((item) => item.width === 3840), '4K playback/capture/export was actually exercised')
  await close()
  await launch()
  const projects = await evaluate('window.api.listProjects()')
  assert.equal(projects[0].id, project.id)
  for (const item of cases) {
    const comments = await evaluate(`window.api.listComments(${JSON.stringify(project.id)},${JSON.stringify(item.versionId)})`)
    assert.equal(comments.length, 1)
    assert.equal(comments[0].annotations.length, 1)
    assert.ok(fs.existsSync(path.join(item.packagePath, 'review.json')))
  }
  assert.deepEqual(runtimeErrors, [])
  const report = { status: 'PASS', executable, cases, notes, artifacts: root }
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

const watchdog = setTimeout(() => { console.error('Packaged smoke exceeded 150 seconds:', root); child?.kill(); process.exit(1) }, 150000)
run().then(async () => { clearTimeout(watchdog); await close() }).catch(async (error) => {
  clearTimeout(watchdog)
  console.error(error.stack)
  console.error('Artifacts:', root)
  if (socket?.readyState === WebSocket.OPEN) {
    try { const image = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(root, 'failure.png'), Buffer.from(image.data, 'base64')) } catch { /* Preserve the original test error. */ }
  }
  await close()
  process.exitCode = 1
})
