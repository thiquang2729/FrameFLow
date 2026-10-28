import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { spawn } from 'node:child_process'
import type { SourceMediaInfo } from '../../shared/types/source-analysis'
import { VIDEO_MAX_BYTES, VIDEO_MAX_DURATION } from './ai-video-adapter'

const positive = (value: unknown): number | null => {
  const number = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN
  return Number.isFinite(number) && number > 0 ? number : null
}
function fraction(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const parts = value.split('/').map(Number)
  return parts.length === 2 && parts[1] > 0 ? positive(parts[0] / parts[1]) : positive(value)
}
const fileIdentity = (file: string, stats: { size: number; mtimeMs: number; ctimeMs: number }): string =>
  `${createHash('sha256').update(path.resolve(file)).digest('hex')}:${stats.size}:${stats.mtimeMs}:${stats.ctimeMs}`

export class SourceMediaService {
  private verified: Promise<void> | null = null
  constructor(private toolsDir: string) {}

  async availability(): Promise<{ ready: boolean; message: string }> {
    try { await this.verify(); return { ready: true, message: '' } }
    catch (error) { return { ready: false, message: error instanceof Error ? error.message : 'Không đọc được công cụ media.' } }
  }

  private verify(): Promise<void> {
    if (!this.verified) this.verified = this.verifyFiles().catch((error) => { this.verified = null; throw error })
    return this.verified
  }

  private async verifyFiles(): Promise<void> {
    let manifest: { files: Record<string, string> }
    try { manifest = JSON.parse(await fs.readFile(path.join(this.toolsDir, 'manifest.json'), 'utf8')) }
    catch { throw new Error('Thiếu FFmpeg/FFprobe đi kèm. Chạy pnpm media:prepare rồi mở lại FrameFlow.') }
    const executable = process.platform === 'win32' ? '.exe' : ''
    if (!manifest.files?.[`bin/ffprobe${executable}`] || !manifest.files?.[`bin/ffmpeg${executable}`]) throw new Error('Bộ công cụ media không hợp lệ.')
    for (const [relative, expected] of Object.entries(manifest.files)) {
      const file = path.resolve(this.toolsDir, relative)
      if (!file.startsWith(path.resolve(this.toolsDir) + path.sep) || typeof expected !== 'string') throw new Error('Manifest media không hợp lệ.')
      const hash = createHash('sha256')
      for await (const data of createReadStream(file)) hash.update(data)
      if (hash.digest('hex') !== expected) throw new Error('Checksum công cụ media sai. Hãy chạy lại pnpm media:prepare.')
    }
  }

  private async execute(tool: 'ffprobe' | 'ffmpeg', args: string[], signal: AbortSignal, timeout = 30000): Promise<string> {
    await this.verify()
    signal.throwIfAborted()
    return new Promise((resolve, reject) => {
      const executable = path.join(this.toolsDir, 'bin', tool + (process.platform === 'win32' ? '.exe' : ''))
      const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, LD_LIBRARY_PATH: path.join(this.toolsDir, 'lib') } })
      const output: Buffer[] = []
      let length = 0
      let reason = ''
      const stop = (message: string) => { reason ||= message; child.kill('SIGKILL') }
      const abort = () => stop('Đã hủy xử lý media.')
      const timer = setTimeout(() => stop('Xử lý media quá thời gian.'), timeout)
      signal.addEventListener('abort', abort, { once: true })
      // Recheck after listener registration to avoid losing a cancellation.
      if (signal.aborted) abort()
      child.stdout.on('data', (data: Buffer) => {
        length += data.length
        if (length > 2 * 1024 * 1024) stop('Metadata media vượt giới hạn.')
        else output.push(data)
      })
      child.stderr.resume()
      const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort) }
      child.once('error', () => { cleanup(); reject(new Error('Không chạy được công cụ media đi kèm.')) })
      child.once('close', (code) => {
        cleanup()
        if (reason || code !== 0) reject(new Error(reason || 'Không giải mã/chuyển mã được video. Kiểm tra định dạng hoặc codec.'))
        else resolve(Buffer.concat(output).toString('utf8'))
      })
    })
  }

  async probe(file: string, signal: AbortSignal): Promise<SourceMediaInfo> {
    const before = await fs.stat(file)
    if (!before.isFile()) throw new Error('SRC không phải tệp video.')
    const raw = await this.execute('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm,avi', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,duration,avg_frame_rate,r_frame_rate', '-of', 'json', '-i', file], signal)
    const data = JSON.parse(raw)
    const video = data.streams?.find((stream: any) => stream.codec_type === 'video')
    const audio = data.streams?.find((stream: any) => stream.codec_type === 'audio')
    const duration = positive(data.format?.duration) || positive(video?.duration)
    if (!video || !duration || !positive(video.width) || !positive(video.height)) throw new Error('Không xác định được thông số video hợp lệ.')
    // Stat fingerprint detects ordinary replacement/modification; not a content hash.
    const fingerprint = fileIdentity(file, before)
    if (await this.fingerprint(file) !== fingerprint) throw new Error('File SRC thay đổi trong khi đọc metadata.')
    return { duration, width: video.width, height: video.height, fps: fraction(video.avg_frame_rate), codec: String(video.codec_name || ''), hasAudio: Boolean(audio), audioCodec: audio ? String(audio.codec_name || '') : null, fileSize: before.size, fingerprint }
  }

  async fingerprint(file: string): Promise<string> {
    const stats = await fs.stat(file)
    if (!stats.isFile()) throw new Error('Tệp SRC không tồn tại.')
    return fileIdentity(file, stats)
  }

  private async readVideo(file: string, signal: AbortSignal): Promise<Buffer> {
    signal.throwIfAborted()
    const handle = await fs.open(file, 'r')
    try {
      const stats = await handle.stat()
      if (!stats.isFile() || stats.size > VIDEO_MAX_BYTES) throw new Error('Video vượt giới hạn 12 MiB.')
      // Hard cap even if a source grows between stat and read.
      const bytes = Buffer.alloc(VIDEO_MAX_BYTES + 1)
      let size = 0
      while (size < bytes.length) {
        signal.throwIfAborted()
        const result = await handle.read(bytes, size, bytes.length - size, null)
        if (!result.bytesRead) break
        size += result.bytesRead
      }
      if (!size || size > VIDEO_MAX_BYTES) throw new Error('Video rỗng hoặc vượt giới hạn 12 MiB.')
      return bytes.subarray(0, size)
    } finally { await handle.close() }
  }

  async prepare(file: string, info: SourceMediaInfo, start: number, end: number, directory: string, signal: AbortSignal): Promise<{ bytes: Buffer; mimeType: string; duration: number; method: 'original' | 'transcoded'; note: string }> {
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > info.duration + 0.01 || end - start > VIDEO_MAX_DURATION) throw new Error('Chọn đoạn video hợp lệ, tối đa 60 giây.')
    const mimeTypes: Record<string, string> = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' }
    const mimeType = mimeTypes[path.extname(file).toLowerCase()]
    if (start === 0 && Math.abs(end - info.duration) < 0.01 && info.fileSize <= VIDEO_MAX_BYTES && mimeType) {
      const bytes = await this.readVideo(file, signal)
      if (bytes.length > VIDEO_MAX_BYTES) throw new Error('Video đã thay đổi hoặc vượt giới hạn 12 MiB.')
      return { bytes, mimeType, duration: info.duration, method: 'original', note: 'Video gốc, không chuyển mã.' }
    }
    await fs.mkdir(directory, { recursive: true })
    const output = path.join(directory, 'clip.mp4')
    // Native MPEG-4 + AAC are available in the LGPL build; no GPL libx264 dependency.
    // Output is a review proxy. Never attribute its sharpness/compression scores to original footage.
    await this.execute('ffmpeg', ['-nostdin', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm,avi', '-i', file, '-ss', String(start), '-t', String(end - start), '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn', '-vf', "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2", '-c:v', 'mpeg4', '-b:v', '900k', '-maxrate', '1200k', '-bufsize', '2400k', '-c:a', 'aac', '-b:a', '96k', '-avoid_negative_ts', 'make_zero', '-movflags', '+faststart', '-n', output], signal, 180000)
    const prepared = await this.probe(output, signal)
    if (prepared.fileSize > VIDEO_MAX_BYTES || prepared.duration > end - start + 0.2) throw new Error('Đoạn chuyển mã vượt dung lượng/thời lượng cho phép. Hãy chọn đoạn ngắn hơn.')
    const bytes = await this.readVideo(output, signal)
    const note = 'Video proxy MPEG-4/AAC tối đa 1280×720. Điểm kỹ thuật phản ánh bản chuyển mã, không phải chất lượng file gốc. Timestamp ánh xạ về đoạn được chọn, có sai số giải mã/khung hình.'
    return { bytes, mimeType: 'video/mp4', duration: Math.min(prepared.duration, end - start), method: 'transcoded', note }
  }
}
