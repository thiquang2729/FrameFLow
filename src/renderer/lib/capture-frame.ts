export interface CapturedFrame {
  base64: string
  timestamp: number
}

// A paused video may not deliver another video-frame callback. Fall back to
// its already decoded frame, but never capture while a seek is in flight.
export async function captureFrame(video: HTMLVideoElement): Promise<CapturedFrame> {
  video.pause()
  if (video.seeking || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    throw new Error('Frame chưa sẵn sàng. Hãy đợi video seek xong rồi thử lại.')
  }
  let timestamp = video.currentTime
  if (typeof video.requestVideoFrameCallback === 'function') {
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        video.cancelVideoFrameCallback(callback)
        resolve()
      }, 150)
      const callback = video.requestVideoFrameCallback((_now, metadata) => {
        window.clearTimeout(timer)
        timestamp = metadata.mediaTime
        resolve()
      })
    })
  }
  if (video.seeking || video.readyState < 2) throw new Error('Video đã thay đổi trong khi chụp frame.')
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Không thể tạo ảnh frame.')
  context.drawImage(video, 0, 0)
  return { base64: canvas.toDataURL('image/jpeg', 0.92), timestamp }
}
