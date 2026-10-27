// Run against a production build: pnpm build, then pnpm test:electron.
// No external media, test framework or user project is needed.
const { app, BrowserWindow, dialog, shell } = require('electron')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const tempBase = process.platform === 'win32' && process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir()
fs.mkdirSync(tempBase, { recursive: true })
const reopening = Boolean(process.env.FRAMEFLOW_SMOKE_REOPEN)
const root = reopening ? process.env.FRAMEFLOW_SMOKE_REOPEN : fs.mkdtempSync(path.join(tempBase, 'frameflow-electron-'))
const home = path.join(root, 'home')
fs.mkdirSync(home, { recursive: true })
// ProjectService currently uses os.homedir(), not Electron's userData path.
// Override it only inside this test process, before importing the application.
os.homedir = () => home
process.env.USERPROFILE = home
process.env.HOME = home
app.setPath('userData', path.join(root, 'electron-profile'))
delete process.env.ELECTRON_RENDERER_URL

let window
const failures = []
const results = []
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const evaluate = async (code) => {
  try { return await window.webContents.executeJavaScript(code, true) }
  catch (error) { console.error('Renderer expression:', code); console.error('Renderer errors:', failures); throw error }
}

async function waitFor(expression, label, timeout = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return
    await delay(50)
  }
  throw new Error(`Timed out: ${label}`)
}

async function clickText(text) {
  const clicked = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === ${JSON.stringify(text)});
    if (!button || button.disabled) return false;
    button.click(); return true;
  })()`)
  assert.ok(clicked, `Button available: ${text}`)
  await delay(80)
}

async function change(selector, value) {
  await evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) throw new Error('Input not found');
    const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  })()`)
  await delay(80)
}

async function key(keyCode, modifiers = []) {
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers })
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers })
  await delay(80)
}

async function draw(start, end) {
  await evaluate(`document.querySelector('canvas[aria-label="Vẽ annotation lên frame"]').scrollIntoView({ block: 'center' })`)
  await delay(80)
  const rect = await evaluate(`(() => { const r = document.querySelector('canvas[aria-label="Vẽ annotation lên frame"]').getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; })()`)
  const xy = (point) => ({ x: Math.round(rect.x + point[0] * rect.width), y: Math.round(rect.y + point[1] * rect.height) })
  window.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...xy(start) })
  window.webContents.sendInputEvent({ type: 'mouseMove', ...xy(end) })
  window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...xy(end) })
  await delay(100)
}

async function recordFixture(width, height) {
  return evaluate(`(async () => {
    const canvas = document.createElement('canvas'); canvas.width = ${width}; canvas.height = ${height};
    const ctx = canvas.getContext('2d');
    const paint = () => { ctx.fillStyle = '#152a43'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle = '#22c55e'; ctx.fillRect(canvas.width * .1, canvas.height * .1, canvas.width * .3, canvas.height * .3); ctx.fillStyle = '#fff'; ctx.font = '24px sans-serif'; ctx.fillText('FrameFlow test', 20, canvas.height - 30); };
    paint(); const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks = []; recorder.ondataavailable = (event) => chunks.push(event.data);
    const finished = new Promise((resolve, reject) => {
      recorder.onerror = reject;
      recorder.onstop = () => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(new Blob(chunks, {type: 'video/webm'})); };
    });
    recorder.start(); const timer = setInterval(paint, 100);
    await new Promise((resolve) => setTimeout(resolve, 1300)); recorder.stop(); clearInterval(timer); stream.getTracks().forEach((track) => track.stop());
    return finished;
  })()`)
}

async function run() {
  await import(pathToFileURL(path.resolve(__dirname, '../out/main/index.js')).href)
  await app.whenReady()
  for (let index = 0; index < 200; index++) {
    window = BrowserWindow.getAllWindows()[0]
    if (window && !window.webContents.isLoading()) break
    await delay(50)
  }
  assert.ok(window, 'Electron window created')
  window.setSize(1600, 1000)
  window.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3) failures.push(message)
  })
  window.webContents.on('render-process-gone', (_event, details) => failures.push(`Renderer exited: ${details.reason}`))
  await waitFor('Boolean(window.api && document.querySelector("nav"))', 'preload and React app')
  assert.equal(await evaluate(`Boolean(document.body.textContent.match(/Jordan Dell|Maya Chen|Alex Lee|Thêm thành viên|Đăng nhập/))`), false)
  results.push('Electron/preload start; no account/team UI')

  if (reopening) {
    const previous = JSON.parse(fs.readFileSync(path.join(root, 'result.json'), 'utf8'))
    await waitFor(`document.body.textContent.includes('Electron Smoke')`, 'project restored from isolated registry')
    await clickText('Electron Smoke')
    await clickText('Duyệt')
    await waitFor('document.body.textContent.includes("Bình luận (1)")', 'comment restored after full process restart')
    await evaluate(`([...document.querySelectorAll('button')].find((item) => item.textContent.includes('Electron integration: move subtitle'))).click()`)
    await waitFor(`Boolean(document.querySelector('canvas[aria-label="Frame đã lưu cùng annotation"]')) && !document.body.textContent.includes('Đang tải frame...')`, 'image restored after restart')
    const saved = await evaluate(`window.api.listComments(${JSON.stringify(previous.project.id)}, ${JSON.stringify(previous.comment.editVersionId)})`)
    assert.equal(saved[0].status, 'FIXED')
    assert.deepEqual(saved[0].annotations, previous.comment.annotations)
    assert.equal(saved[0].timestamp, previous.comment.timestamp)
    const png = saved[0].attachments.find((item) => item.type === 'ANNOTATED_FRAME')
    const rendered = await evaluate(`document.querySelector('canvas').toDataURL('image/png')`)
    assert.deepEqual(Buffer.from(rendered.split(',')[1], 'base64'), fs.readFileSync(path.join(previous.project.projectPath, png.filePath)))
    await window.webContents.capturePage().then((image) => fs.writeFileSync(path.join(root, 'cold-restart.png'), image.toPNG()))
    await clickText('Thư viện SRC')
    await waitFor(`document.querySelectorAll('button[aria-label^="Xem tư liệu "]').length === 4`, 'SRC library restored after process restart')
    const savedSources = await evaluate(`window.api.listSources(${JSON.stringify(previous.project.id)})`)
    assert.deepEqual(JSON.parse(JSON.stringify(savedSources)), previous.sourceAssets)
    for (const asset of savedSources.filter((item) => item.thumbnailPath)) assert.ok(fs.existsSync(path.join(previous.project.projectPath, asset.thumbnailPath)))
    for (const packagePath of previous.packagePaths) {
      const review = JSON.parse(fs.readFileSync(path.join(packagePath, 'review.json'), 'utf8'))
      assert.equal(review.sourceVersionId, previous.comment.editVersionId)
      assert.equal(review.reviews.length, 1)
      for (const item of review.reviews) {
        assert.ok(fs.existsSync(path.join(packagePath, item.frameImage)))
        assert.ok(fs.existsSync(path.join(packagePath, item.annotationImage)))
      }
    }
    assert.deepEqual(failures, [])
    console.log(JSON.stringify({ status: 'PASS', results: ['Full Electron process restart restores project, timestamp, FIXED status and pixel-identical annotation PNG', 'SRC records, metadata, thumbnails and both independent revision packages survive full process restart'], artifacts: root }, null, 2))
    return
  }

  const nativeDialog = dialog.showOpenDialog
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] })
  await clickText('Tạo dự án mới')
  await change('input[aria-label="Tên dự án"]', 'Electron Smoke')
  await change('textarea[aria-label="Mô tả dự án"]', 'Dự án kiểm thử toàn bộ workflow local.')
  await change('select[aria-label="Tỉ lệ dự án"]', '16:9')
  await clickText('Chọn')
  await clickText('Tạo dự án')
  await waitFor(`!document.querySelector('[role="dialog"]') && document.querySelector('[aria-label="Phiên bản dựng"]')?.textContent === '0'`, 'new project has real zero dashboard counts')
  const project = (await evaluate('window.api.listProjects()')).find((item) => item.name === 'Electron Smoke')
  assert.ok(project)
  await clickText('Phiên bản dựng')
  await waitFor(`document.body.textContent.includes('Chưa có bản dựng.')`, 'versions page has empty state, not sample cards')
  const fixtures = []
  for (const [index, width, height] of [[1, 640, 360], [2, 360, 640]]) {
    const data = await recordFixture(width, height)
    const videoPath = path.join(root, `fixture-${index}.webm`)
    fs.writeFileSync(videoPath, Buffer.from(data.split(',')[1], 'base64'))
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [videoPath] })
    await clickText('Thêm bản dựng mới')
    await change('input[aria-label="Tên phiên bản nhập"]', `Test V${index}`)
    await change('input[aria-label="FPS ước tính"]', '10')
    await clickText('Chọn tệp')
    await clickText('Lưu phiên bản')
    await waitFor(`!document.querySelector('[role="dialog"]') && Boolean(document.querySelector('button[aria-label="Duyệt Test V${index}"]'))`, 'UI version import finishes')
    const version = (await evaluate(`window.api.listVersions(${JSON.stringify(project.id)})`)).find((item) => item.versionNumber === index)
    assert.equal(version.width, width)
    assert.equal(version.height, height)
    assert.equal(version.fps, 10)
    if (index === 2) assert.equal(version.parentVersionId, fixtures[0].version.id)
    fixtures.push({ version, width, height })
  }
  dialog.showOpenDialog = nativeDialog
  results.push('Project creation and two video imports use the real UI/probe/IPC; new dashboard starts at zero; version lineage persists')
  await window.webContents.reload()
  await waitFor(`document.body.textContent.includes('Electron Smoke')`, 'test project selected')
  await clickText('Phiên bản dựng')
  await waitFor(`Boolean(document.querySelector('button[aria-label="Duyệt Test V1"]'))`, 'older version button is available')
  await evaluate(`document.querySelector('button[aria-label="Duyệt Test V1"]').click()`)
  await waitFor(`document.querySelector('select[aria-label="Phiên bản đang duyệt"]')?.value === ${JSON.stringify(fixtures[0].version.id)}`, 'older version row opens that version, not latest')
  await clickText('Xuất phản hồi')
  await waitFor(`document.querySelector('select[aria-label="Phiên bản nguồn xuất"]')?.value === ${JSON.stringify(fixtures[0].version.id)}`, 'export inherits older review version')
  await clickText('Phiên bản dựng')
  await waitFor(`Boolean(document.querySelector('button[aria-label="Duyệt Test V2"]'))`, 'versions reload for latest selection')
  await evaluate(`document.querySelector('button[aria-label="Duyệt Test V2"]').click()`)
  await waitFor('Boolean(document.querySelector("video")?.readyState >= 2)', 'video loaded')
  // Latest version is portrait. The preceding version is used for isolation.
  const videoSize = await evaluate(`({ width: document.querySelector('video').videoWidth, height: document.querySelector('video').videoHeight })`)
  assert.deepEqual(videoSize, { width: 360, height: 640 })
  await evaluate('document.activeElement?.blur()')
  await key('Space')
  await waitFor('document.querySelector("video").currentTime > 0.1', 'video plays')
  await key('Space')
  await waitFor('document.querySelector("video").paused', 'Space pauses video')
  await change('input[aria-label="Vị trí phát video"]', '0.5')
  await waitFor('!document.querySelector("video").seeking && document.querySelector("video").currentTime >= 0.4', 'seek actually moves to target')
  await evaluate('document.activeElement?.blur()')
  await key('Right')
  await waitFor('!document.querySelector("video").seeking && Math.abs(document.querySelector("video").currentTime - 0.6) < 0.02', 'right arrow advances one estimated frame')
  await key('Left')
  await waitFor('!document.querySelector("video").seeking && Math.abs(document.querySelector("video").currentTime - 0.5) < 0.02', 'left arrow steps back one frame')
  await key('Right', ['shift'])
  await waitFor('!document.querySelector("video").seeking && document.querySelector("video").currentTime > 1', 'shift-right clamps 5-second skip at video end')
  await key('Left', ['shift'])
  await waitFor('!document.querySelector("video").seeking && document.querySelector("video").currentTime < 0.1', 'shift-left clamps skip at video start')
  await change('input[aria-label="Vị trí phát video"]', '0.5')
  await waitFor('!document.querySelector("video").seeking', 'seek settles before capture shortcut')
  await change('input[aria-label="Âm lượng"]', '0.25')
  assert.equal(await evaluate(`document.querySelector('video').volume`), 0.25)
  await evaluate('document.activeElement?.blur()')
  await key('C')
  await waitFor(`Boolean(document.querySelector('canvas[aria-label="Vẽ annotation lên frame"]'))`, 'captured frame canvas')
  await waitFor('!document.body.textContent.includes("Đang tải frame...")', 'capture image loaded')
  await change('textarea', 'Electron integration: move subtitle')
  await evaluate('document.activeElement?.blur()')
  for (const [shortcut, expected] of [['3', 'HIGH'], ['1', 'LOW'], ['2', 'MEDIUM']]) {
    await key(shortcut)
    assert.equal(await evaluate(`document.querySelectorAll('form select')[1].value`), expected)
  }
  await draw([0.15, 0.15], [0.7, 0.6])
  await evaluate(`document.querySelector('button[aria-label="Màu #2563eb"]').click()`)
  await evaluate(`document.querySelector('button[title="Hình chữ nhật"]').click()`)
  await draw([0.2, 0.25], [0.6, 0.45])
  await evaluate(`document.querySelector('button[title="Hình tròn"]').click()`)
  await evaluate(`document.querySelector('button[title="Lớn"]').click()`)
  await draw([0.3, 0.5], [0.8, 0.8])
  await evaluate(`document.querySelector('button[title="Văn bản"]').click()`)
  await change('input[placeholder="Nội dung annotation..."]', 'Move subtitle')
  await draw([0.1, 0.85], [0.1, 0.85])
  await evaluate(`document.querySelector('button[title="Hoàn tác"]').click()`)
  assert.equal(await evaluate(`document.querySelector('button[title="Làm lại"]').disabled`), false)
  await evaluate(`document.querySelector('button[title="Làm lại"]').click()`)
  assert.equal(await evaluate(`document.querySelector('button[title="Làm lại"]').disabled`), true)
  await window.webContents.capturePage().then((image) => fs.writeFileSync(path.join(root, 'annotation-draft.png'), image.toPNG()))
  await key('Return', ['control'])
  await waitFor('!document.querySelector("textarea")', 'comment saved')
  const comments = await evaluate(`window.api.listComments(${JSON.stringify(project.id)}, ${JSON.stringify(fixtures[1].version.id)})`)
  assert.equal(comments.length, 1)
  const comment = comments[0]
  assert.ok(comment.timestamp >= 0.4 && comment.timestamp <= 0.7, `Captured timestamp follows seek: ${comment.timestamp}`)
  assert.deepEqual(comment.annotations.map((item) => item.type), ['ARROW', 'RECT', 'CIRCLE', 'TEXT'])
  assert.equal(comment.annotations[3].data.text, 'Move subtitle')
  assert.equal(comment.annotations[1].data.color, '#2563eb')
  assert.equal(comment.annotations[2].data.strokeWidth, 6)
  assert.deepEqual(comment.attachments.map((item) => item.type).sort(), ['ANNOTATED_FRAME', 'FRAME'])
  for (const attachment of comment.attachments) assert.ok(fs.existsSync(path.join(project.projectPath, attachment.filePath)))
  const original = comment.attachments.find((item) => item.type === 'FRAME')
  const currentVideoJpeg = await evaluate(`(() => { const video = document.querySelector('video'); const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d').drawImage(video, 0, 0); return canvas.toDataURL('image/jpeg', 0.92); })()`)
  assert.deepEqual(Buffer.from(currentVideoJpeg.split(',')[1], 'base64'), fs.readFileSync(path.join(project.projectPath, original.filePath)))
  results.push('Real WebM playback/seek; portrait capture; draw 4 shapes; undo/redo; save through IPC/SQLite')
  results.push('Keyboard Space, C, D, arrows, Shift-arrows, 1/2/3 priorities and Ctrl+Enter operate on the real player/comment form')

  await waitFor(`Boolean(document.querySelector('canvas[aria-label="Frame đã lưu cùng annotation"]'))`, 'saved frame preview')
  const actual = await evaluate(`(() => { const canvas = document.querySelector('canvas'); return { width: canvas.width, height: canvas.height, png: canvas.toDataURL('image/png') }; })()`)
  assert.equal(actual.width, 360)
  assert.equal(actual.height, 640)
  const png = comment.attachments.find((item) => item.type === 'ANNOTATED_FRAME')
  assert.deepEqual(Buffer.from(actual.png.split(',')[1], 'base64'), fs.readFileSync(path.join(project.projectPath, png.filePath)))
  results.push('Saved JSON re-renders pixel-identical to exported PNG at original resolution')

  await change('input[aria-label="Vị trí phát video"]', '0')
  await waitFor('!document.querySelector("video").seeking && document.querySelector("video").currentTime < 0.1', 'seek away from comment')
  await evaluate(`document.querySelector('div[aria-label="Marker bình luận"] button').click()`)
  await waitFor('!document.querySelector("video").seeking && document.querySelector("video").currentTime >= 0.4', 'timeline marker seeks to comment')

  await change('aside label select', 'FIXED')
  await waitFor(`document.querySelector('aside label select')?.value === 'FIXED'`, 'status updates')
  await change('select[aria-label="Phiên bản đang duyệt"]', fixtures[0].version.id)
  await waitFor('document.body.textContent.includes("Bình luận (0)")', 'version isolation')
  await waitFor('document.querySelector("video")?.readyState >= 2', 'landscape video loads')
  await evaluate('document.activeElement?.blur()')
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'D' })
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'D' })
  await waitFor(`Boolean(document.querySelector('canvas[aria-label="Vẽ annotation lên frame"]')) && !document.body.textContent.includes('Đang tải frame...')`, 'landscape capture loads')
  assert.deepEqual(await evaluate(`({ width: document.querySelector('canvas').width, height: document.querySelector('canvas').height })`), { width: 640, height: 360 })
  await clickText('Hủy')
  assert.equal(fs.readdirSync(path.join(project.projectPath, 'frames')).length, 1)
  assert.equal((await evaluate(`window.api.listComments(${JSON.stringify(project.id)}, ${JSON.stringify(fixtures[0].version.id)})`)).length, 0)
  results.push('Timeline marker seeks correctly; D shortcut captures landscape frame; cancelling creates no file or comment')
  await change('select[aria-label="Phiên bản đang duyệt"]', fixtures[1].version.id)
  await waitFor('document.body.textContent.includes("Bình luận (1)")', 'return to saved version')
  await evaluate(`([...document.querySelectorAll('button')].find((item) => item.textContent.includes('Electron integration: move subtitle'))).click()`)
  await waitFor('Boolean(document.querySelector("canvas"))', 'reopened annotation')
  await window.webContents.reload()
  await waitFor('Boolean(document.querySelector("nav"))', 'React reload')
  await clickText('Duyệt')
  await waitFor('document.body.textContent.includes("Bình luận (1)")', 'persisted comment after reload')
  results.push('Status update, version isolation and renderer reload preserve feedback')

  await window.webContents.capturePage().then((image) => fs.writeFileSync(path.join(root, 'review-reloaded.png'), image.toPNG()))

  // Native dialog selection is controlled here; the SRC UI, browser media probe,
  // thumbnail generation, IPC, filesystem and database are all real.
  const footage = path.join(root, 'footage')
  fs.mkdirSync(path.join(footage, 'nested'), { recursive: true })
  const firstSource = path.join(footage, 'clip #1.webm')
  const brokenSource = path.join(footage, 'broken.webm')
  fs.copyFileSync(fixtures[0].version.videoPath, firstSource)
  fs.copyFileSync(fixtures[1].version.videoPath, path.join(footage, 'nested', 'portrait.webm'))
  fs.copyFileSync(path.join(project.projectPath, original.filePath), path.join(footage, 'nested', 'photo.jpg'))
  fs.writeFileSync(brokenSource, 'Not a decodable video')
  fs.writeFileSync(path.join(footage, 'ignore.txt'), 'Not a supported source')
  await clickText('Thư viện SRC')
  await waitFor(`document.body.textContent.includes('Chưa có tư liệu.')`, 'empty source library, no mock clips')
  const originalDialog = dialog.showOpenDialog
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [firstSource, brokenSource] })
  await clickText('Nhập tư liệu')
  await waitFor(`document.body.textContent.includes('Đã nhập 2 tệp') && !document.body.textContent.includes('Đang nhập:')`, 'multi-file import finishes')
  assert.ok(await evaluate(`document.body.textContent.includes('Không giải mã được media')`), 'unsupported decoder produces an import warning instead of fake metadata')
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [footage] })
  await clickText('Nhập thư mục')
  await waitFor(`document.body.textContent.includes('bỏ qua 2 tệp đã có') && !document.body.textContent.includes('Đang nhập:')`, 'recursive folder import skips duplicates')
  dialog.showOpenDialog = originalDialog
  const sourceAssets = await evaluate(`window.api.listSources(${JSON.stringify(project.id)})`)
  assert.equal(sourceAssets.length, 4)
  assert.ok(sourceAssets.every((item) => item.fps === undefined && item.codec === undefined))
  assert.equal(sourceAssets.filter((item) => item.thumbnailPath).length, 3)
  assert.equal(sourceAssets.find((item) => item.filename === 'broken.webm').width, undefined)
  const landscapeSource = sourceAssets.find((item) => item.filename === 'clip #1.webm')
  assert.equal(landscapeSource.width, 640)
  assert.equal(landscapeSource.height, 360)
  assert.equal(landscapeSource.fileSize, fs.statSync(firstSource).size)
  for (const asset of sourceAssets.filter((item) => item.thumbnailPath)) assert.ok(fs.existsSync(path.join(project.projectPath, asset.thumbnailPath)))
  await change('input[aria-label="Tìm tư liệu"]', '#1')
  assert.equal(await evaluate(`document.querySelectorAll('button[aria-label^="Xem tư liệu "]').length`), 1)
  await evaluate(`document.querySelector('button[aria-label="Dạng danh sách"]').click()`)
  assert.equal(await evaluate(`document.querySelector('button[aria-label="Dạng danh sách"]').getAttribute('aria-pressed')`), 'true')
  await evaluate(`document.querySelector('button[aria-label="Xem tư liệu clip #1.webm"]').click()`)
  await waitFor('document.querySelector("video")?.readyState >= 2', 'source preview decodes path containing #')
  await evaluate(`document.querySelector('video').play()`)
  await waitFor('document.querySelector("video").currentTime > 0.1', 'source preview actually plays')
  await evaluate(`document.querySelector('video').pause()`)
  await change('input[aria-label="Tìm tư liệu"]', '')
  await change('select[aria-label="Sắp xếp tư liệu"]', 'name')
  await window.webContents.capturePage().then((image) => fs.writeFileSync(path.join(root, 'source-library.png'), image.toPNG()))
  results.push('SRC UI imports multiple files and recursive folder, skips duplicates, warns on corrupt media, persists 3 real thumbnails, filters/sorts and previews local media')

  await clickText('Xuất')
  await waitFor(`Boolean(document.querySelector('input[aria-label="Xuất R001"]'))`, 'export page loads real feedback')
  assert.equal(await evaluate(`document.querySelector('input[aria-label="Xuất R001"]').checked`), false, 'resolved feedback is not selected by default')
  await change('select[aria-label="Phiên bản nguồn xuất"]', fixtures[0].version.id)
  await waitFor(`document.body.textContent.includes('Phiên bản này chưa có bình luận.')`, 'export source version isolation')
  await change('select[aria-label="Phiên bản nguồn xuất"]', fixtures[1].version.id)
  await waitFor(`Boolean(document.querySelector('input[aria-label="Xuất R001"]'))`, 'return to reviewed export source')
  await change('input[aria-label="Tên phiên bản đích"]', 'Draft V3')
  const exportInstructions = 'Di chuyển phụ đề xuống thấp. Giữ nguyên âm thanh và màu sắc.'
  await change('textarea[aria-label="Hướng dẫn chỉnh sửa"]', exportInstructions)
  await evaluate(`document.querySelector('input[aria-label="Xuất R001"]').click()`)
  await waitFor(`document.querySelectorAll('ul[aria-label="Danh sách file gói xuất"] li').length === 5`, 'export preview lists real JSON, markdown and both images')
  assert.equal(await evaluate(`document.body.textContent.includes('source_library.json') || document.body.textContent.includes('preferences.json')`), false)
  await change('select[aria-label="Lọc ưu tiên xuất"]', 'HIGH')
  await waitFor(`document.body.textContent.includes('Không có bình luận phù hợp bộ lọc.')`, 'export filter hides unmatching rows')
  assert.equal(await evaluate(`document.querySelectorAll('ul[aria-label="Danh sách file gói xuất"] li').length`), 5, 'hidden selected comment remains in preview')
  await change('select[aria-label="Lọc ưu tiên xuất"]', 'ALL')
  await clickText('Tạo gói chỉnh sửa')
  await waitFor(`Boolean(document.querySelector('[aria-label="Đường dẫn gói đã xuất"]'))`, 'local revision folder is created')
  const firstPackage = await evaluate(`document.querySelector('[aria-label="Đường dẫn gói đã xuất"]').textContent`)
  const firstReviewBytes = fs.readFileSync(path.join(firstPackage, 'review.json'))
  const exportedReview = JSON.parse(firstReviewBytes)
  assert.equal(exportedReview.instructions, exportInstructions)
  assert.equal(exportedReview.sourceVersionId, comment.editVersionId)
  assert.equal(exportedReview.targetVersion, 'Draft V3')
  assert.equal(exportedReview.reviews.length, 1)
  assert.equal(exportedReview.reviews[0].timestamp, 0.5)
  assert.equal(exportedReview.reviews[0].status, 'fixed')
  assert.deepEqual(fs.readFileSync(path.join(firstPackage, exportedReview.reviews[0].frameImage)), fs.readFileSync(path.join(project.projectPath, original.filePath)))
  assert.deepEqual(fs.readFileSync(path.join(firstPackage, exportedReview.reviews[0].annotationImage)), fs.readFileSync(path.join(project.projectPath, png.filePath)))
  assert.ok(fs.readFileSync(path.join(firstPackage, 'instructions.md'), 'utf8').includes(exportInstructions))
  assert.ok(fs.existsSync(path.join(firstPackage, 'README.md')))
  await clickText('Tạo gói chỉnh sửa')
  await waitFor(`document.querySelector('[aria-label="Đường dẫn gói đã xuất"]')?.textContent !== ${JSON.stringify(firstPackage)} && Boolean(document.querySelector('[aria-label="Đường dẫn gói đã xuất"]'))`, 'second export gets a unique directory')
  const secondPackage = await evaluate(`document.querySelector('[aria-label="Đường dẫn gói đã xuất"]').textContent`)
  assert.notEqual(firstPackage, secondPackage)
  assert.deepEqual(fs.readFileSync(path.join(firstPackage, 'review.json')), firstReviewBytes)
  const originalOpenPath = shell.openPath
  let openedPath
  shell.openPath = async (folderPath) => { openedPath = folderPath; return '' }
  await clickText('Mở thư mục gói')
  assert.equal(openedPath, secondPackage)
  shell.openPath = originalOpenPath
  await window.webContents.capturePage().then((image) => fs.writeFileSync(path.join(root, 'export-package.png'), image.toPNG()))
  const packagePaths = [firstPackage, secondPackage]
  results.push('Real Export UI selects version/feedback, preserves hidden selections, previews 5 files, exports exact images/instructions twice without overwrite and opens the correct local folder')
  await clickText('Tổng quan')
  await waitFor(`document.querySelector('[aria-label="Tư liệu SRC"]')?.textContent === '4' && document.querySelector('[aria-label="Phiên bản dựng"]')?.textContent === '2'`, 'dashboard shows real source and version totals')
  assert.equal(await evaluate(`document.querySelector('[aria-label="Phản hồi chưa xong"]').textContent`), '0')
  await window.webContents.capturePage().then((image) => fs.writeFileSync(path.join(root, 'dashboard.png'), image.toPNG()))
  await clickText('Tạo dự án mới')
  await change('input[aria-label="Tên dự án"]', 'Empty Smoke')
  await clickText('Tạo dự án')
  await waitFor(`!document.querySelector('[role="dialog"]') && document.querySelector('[aria-label="Tư liệu SRC"]')?.textContent === '0' && document.querySelector('[aria-label="Phiên bản dựng"]')?.textContent === '0'`, 'switching to a new project does not show previous totals')
  await change('input[aria-label="Tìm dự án"]', 'Empty')
  assert.equal(await evaluate(`Boolean([...document.querySelectorAll('aside button')].find((item) => item.textContent.trim() === 'Electron Smoke'))`), false)
  await change('input[aria-label="Tìm dự án"]', '')
  await clickText('Electron Smoke')
  await waitFor(`document.querySelector('[aria-label="Tư liệu SRC"]')?.textContent === '4'`, 'returning project restores correct totals')
  await evaluate(`document.querySelector('button[aria-label="Mở phản hồi R001"]').click()`)
  await waitFor(`document.querySelector('video')?.currentTime >= 0.4 && Boolean(document.querySelector('canvas[aria-label="Frame đã lưu cùng annotation"]'))`, 'dashboard feedback opens exact version/comment and seeks to timestamp')
  results.push('Older-version navigation is preserved through export; real dashboard totals and project switching stay isolated; recent feedback opens its exact timestamp')
  assert.deepEqual(failures, [], 'No renderer errors')
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify({ passed: results, project, comment, sourceAssets, packagePaths }, null, 2))
  console.log(JSON.stringify({ status: 'PASS', results, artifacts: root }, null, 2))
}

const watchdog = setTimeout(() => { console.error('Electron smoke test exceeded 90 seconds', root); app.exit(1) }, 90000)
run().then(() => { clearTimeout(watchdog); app.quit() }).catch((error) => {
  clearTimeout(watchdog)
  console.error(error.stack)
  console.error('Artifacts:', root)
  if (window && !window.isDestroyed()) {
    window.webContents.capturePage().then((image) => fs.writeFileSync(path.join(root, 'failure.png'), image.toPNG())).finally(() => app.exit(1))
  } else app.exit(1)
})
