import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { createHash, randomBytes } from 'node:crypto'
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process'
import type { AiStatus, AiTestResult } from '../../shared/types/ai'
const VIDEO_MAX_BYTES = 12 * 1024 * 1024

interface AiOptions {
  dataDir: string
  binaryDir: string
  supervisorPath: string
  nodePath: string
  openExternal: (url: string) => Promise<void>
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function freeLocalPort(preferredPort = 0): Promise<number> {
  const server = net.createServer()
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(preferredPort, '127.0.0.1', resolve)
    })
  } catch (error) {
    if (preferredPort && (error as NodeJS.ErrnoException).code === 'EADDRINUSE') return freeLocalPort()
    throw error
  }
  const port = (server.address() as net.AddressInfo).port
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return port
}

export class AiService {
  private status: AiStatus = {
    state: 'stopped', message: 'AI chưa khởi động.', version: '8.0.45', endpoint: null,
    pid: null, accounts: 0, login: 'idle', loginMessage: '', selectedModel: ''
  }
  private server: ChildProcessWithoutNullStreams | null = null
  private loginProcess: ChildProcessWithoutNullStreams | null = null
  private startTask: Promise<AiStatus> | null = null
  private restartTask: Promise<AiStatus> | null = null
  private stopping = false
  private key = ''
  private configPath: string
  private authDir: string
  private binary: string
  private testController: AbortController | null = null
  private loginTimer: ReturnType<typeof setTimeout> | null = null
  private videoController: AbortController | null = null

  constructor(private options: AiOptions) {
    this.configPath = path.join(options.dataDir, 'runtime.yaml')
    this.authDir = path.join(options.dataDir, 'auth')
    this.binary = path.join(options.binaryDir, process.platform === 'win32' ? 'cli-proxy-api.exe' : 'cli-proxy-api')
    fs.mkdirSync(this.authDir, { recursive: true, mode: 0o700 })
    try {
      const settings = JSON.parse(fs.readFileSync(path.join(options.dataDir, 'settings.json'), 'utf8'))
      if (typeof settings.selectedModel === 'string') this.status.selectedModel = settings.selectedModel.slice(0, 200)
    } catch { /* No model selected yet. */ }
  }

  getStatus(): AiStatus {
    let accounts = 0
    for (const entry of fs.readdirSync(this.authDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      try {
        const file = path.join(this.authDir, entry.name)
        if (fs.statSync(file).size > 1024 * 1024) continue
        const auth = JSON.parse(fs.readFileSync(file, 'utf8'))
        if (auth.type === 'antigravity' && !auth.disabled) accounts++
      } catch { /* Proxy may be atomically replacing a credential. */ }
    }
    return { ...this.status, accounts }
  }

  private verifyBinary(): void {
    if (!fs.existsSync(this.binary)) throw new Error('Thiếu CLIProxyAPI đi kèm. Chạy pnpm ai:prepare rồi mở lại ứng dụng.')
    const manifest = JSON.parse(fs.readFileSync(path.join(this.options.binaryDir, 'manifest.json'), 'utf8'))
    const hash = createHash('sha256').update(fs.readFileSync(this.binary)).digest('hex')
    if (manifest.version !== this.status.version || manifest.target !== `${process.platform}-${process.arch}` || hash !== manifest.sha256) {
      throw new Error('CLIProxyAPI không đúng phiên bản hoặc checksum. Hãy chuẩn bị lại bộ cài.')
    }
  }

  private launch(mode: 'server' | 'login', callbackPort = 0): ChildProcessWithoutNullStreams {
    return spawn(this.options.nodePath, [this.options.supervisorPath, this.binary, this.configPath, mode, String(callbackPort)], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })
  }

  private messages(child: ChildProcessWithoutNullStreams, receive: (event: { type: string; pid?: number; text?: string; code?: number }) => void): void {
    let pending = ''
    child.stdout.on('data', (bytes) => {
      pending += bytes.toString('utf8')
      if (pending.length > 256 * 1024) { pending = ''; return }
      let newline: number
      while ((newline = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, newline)
        pending = pending.slice(newline + 1)
        try { receive(JSON.parse(line)) } catch { /* Never expose raw proxy output. */ }
      }
    })
    child.stderr.resume()
    child.stdin.on('error', () => {})
  }

  start(): Promise<AiStatus> {
    if (this.startTask) return this.startTask
    if (this.status.state === 'ready') return Promise.resolve(this.getStatus())
    this.startTask = this.startServer().finally(() => { this.startTask = null })
    return this.startTask
  }

  private async startServer(): Promise<AiStatus> {
    this.stopping = false
    this.status.state = 'starting'
    this.status.message = 'Đang khởi động CLIProxyAPI...'
    try {
      this.verifyBinary()
      // Keep FrameFlow separate from standalone CLIProxyAPI instances on 8317.
      const port = await freeLocalPort(18317)
      if (this.stopping) return this.getStatus()
      this.key = randomBytes(32).toString('hex')
      // Ephemeral client key, regenerated on every start; never returned via IPC.
      const config = {
        'config-version': 8,
        server: { host: '127.0.0.1', port, 'max-request-body-bytes': 20 * 1024 * 1024, discovery: { enabled: false } },
        access: { 'api-keys': [this.key] },
        management: { 'allow-remote': false, 'secret-key': '', 'disable-control-panel': true, 'disable-auto-update-panel': true },
        oauth: { 'auth-dir': this.authDir },
        routing: { retry: { 'request-retry': 0, 'max-retry-interval': 0 } },
        observability: { logs: { debug: false, 'logging-to-file': false, 'request-log': false, 'error-logs-max-files': 1 }, pprof: { enable: false } },
        plugins: { enabled: false }
      }
      // JSON is also valid YAML. Separate from project databases and revision exports.
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), { mode: 0o600 })
      this.status.endpoint = `http://127.0.0.1:${port}/v1`
      const child = this.launch('server')
      this.server = child
      this.messages(child, (event) => {
        if (this.server === child && event.type === 'spawn') this.status.pid = event.pid || null
      })
      child.once('error', () => this.serverFailed(child))
      child.once('exit', () => this.serverFailed(child))
      const deadline = Date.now() + 30000
      while (Date.now() < deadline) {
        if (this.stopping || this.server !== child) break
        try {
          await this.request('/models', undefined, 1200)
          if (this.stopping || this.server !== child || child.exitCode !== null) break
          this.status.state = 'ready'
          this.status.message = 'CLIProxyAPI đang chạy cùng FrameFlow.'
          return this.getStatus()
        } catch { await delay(200) }
      }
      if (!this.stopping) throw new Error('CLIProxyAPI không sẵn sàng. Hãy thử khởi động lại kết nối AI.')
    } catch (error) {
      await this.endProcess(this.server)
      this.server = null
      this.status.state = 'error'
      this.status.pid = null
      this.status.endpoint = null
      this.status.message = error instanceof Error ? error.message : 'Không thể khởi động AI.'
      this.removeRuntime()
    }
    return this.getStatus()
  }

  private serverFailed(child: ChildProcessWithoutNullStreams): void {
    if (this.server !== child) return
    this.server = null
    this.status.pid = null
    this.status.endpoint = null
    if (!this.stopping) {
      this.status.state = 'error'
      this.status.message = 'CLIProxyAPI đã dừng bất ngờ. Chức năng duyệt video vẫn dùng bình thường; hãy khởi động lại AI.'
    }
  }

  private async request(route: string, body?: object, timeout = 15000, signal?: AbortSignal, nativeGemini = false): Promise<any> {
    if (!this.status.endpoint) throw new Error('Proxy chưa chạy.')
    const base = nativeGemini ? this.status.endpoint.replace(/\/v1$/, '/v1beta') : this.status.endpoint
    const response = await fetch(base + route, {
      method: body ? 'POST' : 'GET', redirect: 'error',
      headers: { Authorization: `Bearer ${this.key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: signal || AbortSignal.timeout(timeout)
    })
    if (!response.ok) {
      await response.body?.cancel()
      const messages: Record<number, string> = {
        401: 'Proxy từ chối khóa truy cập. Hãy khởi động lại AI.',
        403: 'Tài khoản không có quyền dùng model này. Hãy kiểm tra Antigravity hoặc đăng nhập lại.',
        404: 'Model không còn khả dụng. Hãy tải lại danh sách model.',
        400: 'Model hoặc tuyến Antigravity từ chối định dạng yêu cầu. Chưa thể xác nhận hỗ trợ video.',
        413: 'Video vượt giới hạn của proxy hoặc upstream. Hãy chọn đoạn ngắn hơn.',
        415: 'Tuyến AI không chấp nhận định dạng video này.',
        429: 'Tài khoản đã chạm giới hạn. Hãy chờ rồi thử lại.',
        503: 'Chưa có tài khoản AI khả dụng. Hãy đăng nhập Antigravity.'
      }
      throw new Error(messages[response.status] || `AI trả về lỗi HTTP ${response.status}. Hãy thử lại hoặc đăng nhập lại.`)
    }
    // Bound proxy responses rather than buffering an arbitrary upstream payload.
    const reader = response.body?.getReader()
    if (!reader) throw new Error('AI trả về dữ liệu rỗng.')
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('Phản hồi AI vượt quá giới hạn dung lượng.') }
      chunks.push(value)
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
    catch { throw new Error('AI trả về dữ liệu không hợp lệ.') }
  }

  async listModels(): Promise<string[]> {
    if (this.status.state !== 'ready') throw new Error('Chờ proxy sẵn sàng trước khi lấy model.')
    const result = await this.request('/models')
    if (!Array.isArray(result.data)) throw new Error('Danh sách model không hợp lệ.')
    return [...new Set<string>(result.data.filter((item: any) => typeof item?.id === 'string' && item.id.length <= 200).map((item: any) => item.id))].sort()
  }

  async selectModel(model: string): Promise<void> {
    if (typeof model !== 'string' || !(await this.listModels()).includes(model)) throw new Error('Hãy chọn model có trong danh sách proxy.')
    fs.writeFileSync(path.join(this.options.dataDir, 'settings.json'), JSON.stringify({ selectedModel: model }), { mode: 0o600 })
    this.status.selectedModel = model
  }

  async listVideoModelCandidates(): Promise<string[]> {
    if (this.status.state !== 'ready') return []
    // Catalog membership is not proof of video capability. Keep this distinction in the UI.
    const result = await this.request('/models', undefined, 15000, undefined, true)
    if (!Array.isArray(result.models)) throw new Error('Proxy chưa cung cấp danh sách model theo giao thức Gemini.')
    return [...new Set<string>(result.models
      .filter((item: any) => typeof item?.name === 'string')
      .map((item: any) => item.name.replace(/^models\//, ''))
      .filter((name: string) => name.length <= 200 && /gemini/i.test(name) && !/image|embedding|tts/i.test(name)))].sort()
  }

  async generateVideo(model: string, bytes: Buffer, mimeType: string, prompt: string, signal: AbortSignal): Promise<{ text: string; returnedModel: string | null }> {
    if (this.videoController) throw new Error('Đang có một yêu cầu video khác. Hãy chờ hoặc hủy tác vụ.')
    if (this.status.state !== 'ready' || !this.getStatus().accounts) throw new Error('Hãy kết nối và đăng nhập Antigravity trước.')
    if (bytes.length > VIDEO_MAX_BYTES || !bytes.length) throw new Error('Video phải nhỏ hơn hoặc bằng 12 MiB.')
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(mimeType)) throw new Error('Định dạng video chưa được phép gửi.')
    if (!(await this.listVideoModelCandidates()).includes(model)) throw new Error('Model không có trong danh sách Gemini của proxy.')
    if (signal.aborted) throw new Error('Đã hủy phân tích.')
    if (this.videoController) throw new Error('Đang có một yêu cầu video khác.')
    const controller = new AbortController()
    this.videoController = controller
    const abort = () => controller.abort()
    signal.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(abort, 180000)
    try {
      // v8.0.45 Gemini→Antigravity translation preserves native contents/inlineData.
      // No Files API, image extraction, OpenAI payload conversion or provider fallback.
      const response = await this.request(`/models/${encodeURIComponent(model)}:generateContent`, {
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: bytes.toString('base64') } }, { text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 10000, temperature: 0.1 }
      }, 180000, controller.signal, true)
      const candidate = response.candidates?.[0]
      if (candidate?.finishReason !== 'STOP') throw new Error('Phản hồi video bị chặn, bị cắt hoặc chưa hoàn tất. Không lưu đánh giá một phần.')
      const parts = candidate.content?.parts
      if (!Array.isArray(parts)) throw new Error('Tuyến AI không trả kết quả Gemini hợp lệ cho video.')
      const text = parts.filter((part: any) => typeof part?.text === 'string' && !part.thought).map((part: any) => part.text).join('')
      if (!text.trim()) throw new Error('AI không trả kết quả đánh giá video.')
      return { text, returnedModel: typeof response.modelVersion === 'string' ? response.modelVersion.slice(0, 200) : null }
    } catch (error) {
      if (controller.signal.aborted) throw new Error(signal.aborted ? 'Đã hủy phân tích.' : 'Phân tích video quá thời gian 180 giây.')
      if (error instanceof TypeError) throw new Error('Mất kết nối tới CLIProxyAPI khi gửi video.')
      throw error
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      this.videoController = null
    }
  }

  async testPrompt(model: string, prompt: string): Promise<AiTestResult> {
    if (this.testController) throw new Error('Đang có một yêu cầu AI. Hãy chờ hoặc hủy yêu cầu.')
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8000) throw new Error('Nhập câu hỏi từ 1 đến 8.000 ký tự.')
    if (typeof model !== 'string' || !(await this.listModels()).includes(model)) throw new Error('Model không khả dụng. Hãy tải lại danh sách.')
    // Recheck after awaiting model discovery to prevent concurrent requests.
    if (this.testController) throw new Error('Đang có một yêu cầu AI.')
    const controller = new AbortController()
    this.testController = controller
    const timer = setTimeout(() => controller.abort(), 90000)
    const started = Date.now()
    try {
      const result = await this.request('/chat/completions', {
        model, messages: [{ role: 'user', content: prompt.trim() }], stream: false, max_tokens: 512
      }, 90000, controller.signal)
      const text = result.choices?.[0]?.message?.content
      if (typeof text !== 'string' || !text.trim()) throw new Error('Model không trả lời bằng văn bản. Hãy thử model khác.')
      return { model, text, durationMs: Date.now() - started }
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Yêu cầu AI đã bị hủy hoặc quá thời gian 90 giây.')
      if (error instanceof TypeError) throw new Error('Mất kết nối với proxy. Hãy kiểm tra trạng thái AI.')
      throw error
    } finally {
      clearTimeout(timer)
      this.testController = null
    }
  }

  cancelTest(): void { this.testController?.abort() }

  async login(): Promise<AiStatus> {
    if (this.status.state !== 'ready') throw new Error('Chờ proxy sẵn sàng rồi đăng nhập.')
    if (this.loginProcess) return this.getStatus()
    // Mark before awaiting a port so repeated clicks cannot launch two OAuth flows.
    if (this.status.login === 'waiting') return this.getStatus()
    this.status.login = 'waiting'
    this.status.loginMessage = 'Đang mở trình duyệt đăng nhập Google...'
    try {
      const port = await freeLocalPort()
      if (this.stopping) throw new Error('Ứng dụng đang đóng.')
      const child = this.launch('login', port)
      this.loginProcess = child
      let output = ''
      let opened = false
      let saved = false
      this.messages(child, (event) => {
        if (event.type !== 'output' || !event.text) return
        output = (output + event.text).slice(-32768)
        if (output.includes('Antigravity authentication successful!')) saved = true
        if (opened) return
        const match = output.match(/https:\/\/accounts\.google\.com\/[^\s\x1b]+/)
        if (!match) return
        // Wait for a complete printed line, not a partial pipe chunk.
        if (!output.slice(output.indexOf(match[0]) + match[0].length).match(/^\s/)) return
        const url = new URL(match[0])
        if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com') return
        opened = true
        this.status.loginMessage = 'Hãy hoàn tất đăng nhập trong trình duyệt. Không cần dán token vào ứng dụng.'
        void this.options.openExternal(url.href).catch(() => {
          this.status.loginMessage = 'Không mở được trình duyệt. Hãy kiểm tra trình duyệt mặc định và đăng nhập lại.'
          this.cancelLogin()
        })
      })
      const finish = () => {
        if (this.loginProcess !== child) return
        if (this.loginTimer) clearTimeout(this.loginTimer)
        this.loginTimer = null
        this.loginProcess = null
        this.status.login = saved && this.getStatus().accounts > 0 ? 'success' : 'error'
        this.status.loginMessage = this.status.login === 'success'
          ? 'Đã lưu đăng nhập Antigravity. Hãy tải danh sách model và gửi câu hỏi thử.'
          : 'Đăng nhập chưa hoàn tất. Hãy thử lại và xác nhận tài khoản có quyền dùng Antigravity.'
        output = ''
      }
      child.once('error', finish)
      child.once('exit', finish)
      this.loginTimer = setTimeout(() => { this.cancelLogin() }, 5 * 60 * 1000)
    } catch {
      this.status.login = 'error'
      this.status.loginMessage = 'Không thể bắt đầu đăng nhập. Hãy khởi động lại AI rồi thử lại.'
    }
    return this.getStatus()
  }

  cancelLogin(): void {
    if (this.loginTimer) clearTimeout(this.loginTimer)
    this.loginTimer = null
    const child = this.loginProcess
    this.loginProcess = null
    if (child) void this.endProcess(child)
    this.status.login = 'idle'
    this.status.loginMessage = 'Đã hủy đăng nhập.'
  }

  private async endProcess(child: ChildProcessWithoutNullStreams | null): Promise<void> {
    if (!child || child.exitCode !== null) return
    // Closing the lease asks the watchdog to stop only its own Go child.
    const exited = new Promise<void>((resolve) => child.once('close', () => resolve()))
    child.stdin.end()
    await Promise.race([exited, delay(4000)])
    if (child.exitCode === null) child.kill()
  }

  private removeRuntime(): void {
    this.key = ''
    try { fs.unlinkSync(this.configPath) } catch { /* Already removed. */ }
  }

  async stop(): Promise<void> {
    this.stopping = true
    this.cancelTest()
    this.videoController?.abort()
    const login = this.loginProcess
    this.loginProcess = null
    if (this.loginTimer) clearTimeout(this.loginTimer)
    this.loginTimer = null
    await Promise.all([this.endProcess(login), this.endProcess(this.server)])
    if (this.startTask) await this.startTask
    this.server = null
    this.removeRuntime()
    this.status.state = 'stopped'
    this.status.pid = null
    this.status.endpoint = null
    this.status.login = 'idle'
    this.status.message = 'AI đã dừng.'
  }

  restart(): Promise<AiStatus> {
    if (this.restartTask) return this.restartTask
    this.restartTask = (async () => { await this.stop(); return this.start() })()
      .finally(() => { this.restartTask = null })
    return this.restartTask
  }
}
