import { ImportSourceDTO } from '@shared/types'
import { isSourceImage } from '@shared/media'

export function localFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return encodeURI(normalized.startsWith('//') ? `file:${normalized}` : `file:///${normalized.replace(/^\//, '')}`)
    .replace(/#/g, '%23').replace(/\?/g, '%3F')
}

export interface SourceProbe {
  metadata: Pick<ImportSourceDTO, 'duration' | 'width' | 'height' | 'thumbnailBase64'>
  warning?: string
}

// Native browser decoders provide dimensions/duration, not reliable FPS/codec.
// Never invent those values or keep a decoder alive after import/unmount.
export function probeSource(filePath: string, signal: AbortSignal): Promise<SourceProbe> {
  return new Promise((resolve, reject) => {
    const image = isSourceImage(filePath) ? new Image() : null
    const video = image ? null : document.createElement('video')
    let settled = false
    const cleanup = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      if (image) { image.onload = null; image.onerror = null; image.src = '' }
      if (video) {
        video.onloadeddata = null
        video.onerror = null
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
    }
    const finish = (result: SourceProbe) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }
    const abort = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new DOMException('Import cancelled', 'AbortError'))
    }
    const timer = window.setTimeout(() => finish({ metadata: {}, warning: 'Đọc metadata quá thời gian; đã lưu đường dẫn, chưa có thumbnail.' }), 8000)
    const capture = () => {
      const width = image?.naturalWidth || video?.videoWidth || 0
      const height = image?.naturalHeight || video?.videoHeight || 0
      const duration = video && Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined
      const metadata: SourceProbe['metadata'] = { width: width || undefined, height: height || undefined, duration }
      try {
        if (width && height) {
          const canvas = document.createElement('canvas')
          const scale = Math.min(1, 480 / Math.max(width, height))
          canvas.width = Math.max(1, Math.round(width * scale))
          canvas.height = Math.max(1, Math.round(height * scale))
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Canvas unavailable')
          context.drawImage((image || video)!, 0, 0, canvas.width, canvas.height)
          metadata.thumbnailBase64 = canvas.toDataURL('image/jpeg', 0.8)
        }
        finish({ metadata, warning: video && !duration ? 'Chưa xác định được thời lượng của tệp này.' : undefined })
      } catch {
        finish({ metadata, warning: 'Đã đọc metadata nhưng không tạo được thumbnail.' })
      }
    }
    const fail = () => finish({ metadata: {}, warning: 'Không giải mã được media; đã lưu đường dẫn. Kiểm tra codec hoặc vị trí tệp.' })
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) { abort(); return }
    if (image) { image.onload = capture; image.onerror = fail; image.src = localFileUrl(filePath) }
    if (video) {
      video.preload = 'auto'
      video.muted = true
      video.onloadeddata = capture
      video.onerror = fail
      video.src = localFileUrl(filePath)
    }
  })
}
