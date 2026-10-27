const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const ts = require('typescript')

function load(relativePath, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const exports = {}
  new Function('exports', ...Object.keys(globals), output)(exports, ...Object.values(globals))
  return exports
}

const { drawAnnotations } = load('src/renderer/lib/draw-annotations.ts')
const shape = (type, data) => ({ type, data: { type, color: '#ef4444', strokeWidth: 4, ...data } })

test('renders normalized geometry without distorting landscape, portrait or 4K frames', () => {
  for (const [width, height] of [[1280, 720], [1080, 1920], [3840, 2160]]) {
    const calls = []
    const context = new Proxy({}, { get: (target, name) => name in target ? target[name] : (...args) => calls.push([name, ...args]) })
    drawAnnotations(context, [
      shape('ARROW', { points: [0.1, 0.2, 0.8, 0.7] }),
      shape('RECT', { x: 0.1, y: 0.2, width: 0.4, height: 0.3 }),
      shape('CIRCLE', { x: 0.2, y: 0.2, width: 0.4, height: 0.4 }),
      shape('TEXT', { x: 0.1, y: 0.2, text: 'Subtitle', fontSize: 24 })
    ], width, height)
    assert.deepEqual(calls.find((call) => call[0] === 'strokeRect'), ['strokeRect', width * 0.1, height * 0.2, width * 0.4, height * 0.3])
    assert.deepEqual(calls.find((call) => call[0] === 'ellipse').slice(1, 5), [width * 0.4, height * 0.4, width * 0.2, height * 0.2])
    assert.deepEqual(calls.find((call) => call[0] === 'moveTo'), ['moveTo', width * 0.1, height * 0.2])
    assert.equal(context.lineWidth, 4 * width / 960)
    assert.equal(context.font, `bold ${24 * width / 960}px sans-serif`)
    assert.equal(calls.filter((call) => call[0] === 'save').length, 4)
    assert.equal(calls.filter((call) => call[0] === 'restore').length, 4)
  }
})

test('capture pauses video, preserves source resolution and exports JPEG', async () => {
  const calls = []
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (...args) => calls.push(args) }), toDataURL: (type) => `data:${type};base64,test` }
  const { captureFrame } = load('src/renderer/lib/capture-frame.ts', { document: { createElement: () => canvas } })
  const video = { pause: () => calls.push('pause'), seeking: false, readyState: 2, videoWidth: 1080, videoHeight: 1920, currentTime: 17.42 }
  const result = await captureFrame(video)
  assert.equal(calls[0], 'pause')
  assert.equal(canvas.width, 1080)
  assert.equal(canvas.height, 1920)
  assert.equal(result.timestamp, 17.42)
  assert.equal(result.base64, 'data:image/jpeg;base64,test')
  assert.deepEqual(calls[1], [video, 0, 0])
  await assert.rejects(() => captureFrame({ ...video, seeking: true }))
  await assert.rejects(() => captureFrame({ ...video, readyState: 1 }))
})

test('capture prefers presented frame timestamp and falls back when paused callback does not arrive', async () => {
  for (const deliversCallback of [true, false]) {
    let cancelled = false
    const canvas = { getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'data:image/jpeg;base64,test' }
    const { captureFrame } = load('src/renderer/lib/capture-frame.ts', {
      document: { createElement: () => canvas },
      window: { setTimeout: (callback) => setTimeout(callback, 1), clearTimeout }
    })
    const video = {
      pause: () => {}, seeking: false, readyState: 2, videoWidth: 1920, videoHeight: 1080, currentTime: 10.01,
      requestVideoFrameCallback: (callback) => { if (deliversCallback) queueMicrotask(() => callback(0, { mediaTime: 10 })); return 1 },
      cancelVideoFrameCallback: () => { cancelled = true }
    }
    const result = await captureFrame(video)
    assert.equal(result.timestamp, deliversCallback ? 10 : 10.01)
    assert.equal(cancelled, !deliversCallback)
  }
})
