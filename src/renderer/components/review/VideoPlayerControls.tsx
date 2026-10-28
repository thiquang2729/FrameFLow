import React, { useEffect, useMemo, useState } from 'react'
import {
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Film,
  Activity,
  MessageSquare,
  ChevronDown,
  Pen
} from 'lucide-react'
import { ReviewComment } from '@shared/types'

function formatTime(seconds: number): string {
  const ms = Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * 1000))
  return `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}

interface VideoPlayerControlsProps {
  time: number
  duration: number
  fps?: number
  playing: boolean
  volume: number
  ready: boolean
  saving: boolean
  capturing: boolean
  comments: ReviewComment[]
  playbackRate: number
  videoSrc?: string
  drawingMode?: boolean
  onSeek: (time: number) => void
  onTogglePlay: () => void
  onVolumeChange: (volume: number) => void
  onPlaybackRateChange: (rate: number) => void
  onFullscreen: () => void
  onPickComment: (comment: ReviewComment) => void
  onToggleDrawing?: () => void
}

export const VideoPlayerControls: React.FC<VideoPlayerControlsProps> = ({
  time,
  duration,
  fps = 30,
  playing,
  volume,
  ready,
  saving,
  capturing,
  comments,
  playbackRate,
  videoSrc,
  drawingMode = false,
  onSeek,
  onTogglePlay,
  onVolumeChange,
  onPlaybackRateChange,
  onFullscreen,
  onPickComment,
  onToggleDrawing
}) => {
  const percent = duration > 0 ? Math.min(100, Math.max(0, (time / duration) * 100)) : 0

  // 1. Filmstrip thumbnails generation from video
  const [thumbnails, setThumbnails] = useState<string[]>([])

  useEffect(() => {
    if (!videoSrc || !duration || duration <= 0) {
      setThumbnails([])
      return
    }

    let cancelled = false
    const count = 48

    const generate = async () => {
      const video = document.createElement('video')
      video.muted = true
      video.preload = 'auto'
      // Offscreen in DOM ensures hardware decoder prioritization in Chromium
      video.style.position = 'fixed'
      video.style.left = '-9999px'
      video.style.top = '-9999px'
      video.style.width = '4px'
      video.style.height = '4px'
      video.style.opacity = '0'
      video.style.pointerEvents = 'none'
      document.body.appendChild(video)

      video.src = videoSrc

      // 1. Wait until video is ready to play (readyState >= 2)
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) return resolve()
        let done = false
        const onReady = () => {
          if (!done && video.readyState >= 2) {
            done = true
            video.removeEventListener('loadeddata', onReady)
            video.removeEventListener('canplay', onReady)
            resolve()
          }
        }
        video.addEventListener('loadeddata', onReady)
        video.addEventListener('canplay', onReady)
        video.onerror = () => resolve()
      })

      if (cancelled || !video.videoWidth || !video.videoHeight) {
        if (video.parentNode) video.parentNode.removeChild(video)
        return
      }

      // 2. Decoder warm-up: seek to first frame so the GPU decoder surface is fully initialized
      await new Promise<void>((resolve) => {
        let done = false
        const timer = setTimeout(() => {
          if (!done) {
            done = true
            resolve()
          }
        }, 600)
        video.onseeked = () => {
          if (!done) {
            done = true
            clearTimeout(timer)
            requestAnimationFrame(() => resolve())
          }
        }
        video.currentTime = 0.05
      })

      if (cancelled) {
        if (video.parentNode) video.parentNode.removeChild(video)
        return
      }

      const canvas = document.createElement('canvas')
      const targetHeight = 96
      const targetWidth = Math.round((video.videoWidth / video.videoHeight) * targetHeight)
      canvas.width = Math.max(48, Math.min(240, targetWidth))
      canvas.height = targetHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        if (video.parentNode) video.parentNode.removeChild(video)
        return
      }
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      const step = duration / count
      const result: string[] = []

      for (let i = 0; i < count; i++) {
        if (cancelled) break
        const targetTime = Math.min(duration - 0.02, Math.max(0.02, (i + 0.5) * step))

        await new Promise<void>((resolve) => {
          let done = false
          const finish = () => {
            if (!done) {
              done = true
              clearTimeout(timer)
              resolve()
            }
          }
          const timer = setTimeout(finish, 250)
          video.onseeked = () => {
            if (done) return
            requestAnimationFrame(() => finish())
          }
          video.currentTime = targetTime
        })

        if (video.seeking) {
          await new Promise<void>((res) => {
            video.onseeked = () => res()
            setTimeout(res, 80)
          })
        }

        if (cancelled) break
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          result.push(canvas.toDataURL('image/jpeg', 0.9))
          // Batch UI updates every 4 frames or on the last frame
          if (i % 4 === 0 || i === count - 1) {
            if (!cancelled) setThumbnails([...result])
          }
        } catch {
          // ignore canvas capture error
        }
      }

      if (video.parentNode) video.parentNode.removeChild(video)
      video.src = ''
      video.load()
    }

    void generate()

    return () => {
      cancelled = true
    }
  }, [videoSrc, duration])

  // 2. Generate ruler markers (5 divisions based on duration)
  const rulerTicks = useMemo(() => {
    if (!duration || duration <= 0) return [{ percent: 0, time: 0 }, { percent: 100, time: 0 }]
    const count = 5
    const step = duration / count
    const ticks: Array<{ percent: number; time: number }> = []
    for (let i = 0; i <= count; i++) {
      const t = Math.min(duration, i * step)
      ticks.push({
        percent: (t / duration) * 100,
        time: t
      })
    }
    return ticks
  }, [duration])

  // 3. Realistic audio spectrum bars waveform (CapCut/Premiere style with peak indicators)
  const audioBars = useMemo(() => {
    const totalBars = 220
    const bars: Array<{ height: number; isPeak: boolean }> = []
    for (let i = 0; i < totalBars; i++) {
      const s1 = Math.sin(i * 0.16) * 0.45
      const s2 = Math.cos(i * 0.07 + 1.4) * 0.35
      const s3 = Math.sin(i * 0.55) * 0.15
      const noise = Math.sin(i * 2.8) * 0.12 + 0.08
      const val = Math.abs(s1 + s2 + s3 + noise)
      // Height between 3px and 17px (total height is 20px)
      const height = Math.max(3, Math.min(17, Math.round(val * 17)))
      const isPeak = height >= 15
      bars.push({ height, isPeak })
    }
    return bars
  }, [])

  // Color mapping for comment pins based on status or priority
  const getMarkerColor = (comment: ReviewComment) => {
    if (comment.status === 'FIXED') return 'bg-emerald-500'
    if (comment.priority === 'CRITICAL' || comment.priority === 'HIGH') return 'bg-amber-500'
    if (comment.category === 'SUBTITLE') return 'bg-purple-500'
    return 'bg-blue-500'
  }

  return (
    <div className="bg-white border-t border-slate-200 px-4 py-3 space-y-3 shrink-0 select-none">
      {/* 1. Playback Control Bar */}
      <div className="flex items-center justify-between gap-2.5 sm:gap-3 text-xs flex-nowrap min-w-0">
        {/* Left: Time indicator */}
        <div className="font-mono text-xs font-semibold text-slate-700 min-w-[130px] tabular-nums shrink-0 whitespace-nowrap">
          {formatTime(time)} <span className="text-slate-400 font-normal">/</span> {formatTime(duration)}
        </div>

        {/* Center: Playback Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            aria-label="Frame trước"
            disabled={!ready || saving || capturing}
            onClick={() => onSeek(Math.max(0, time - 1 / fps))}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 transition-colors"
            title="Lùi 1 frame (←)"
          >
            <SkipBack size={15} />
          </button>
          <button
            type="button"
            aria-label={playing ? 'Tạm dừng' : 'Phát'}
            disabled={!ready || saving || capturing}
            onClick={onTogglePlay}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 shadow-xs transition-all active:scale-95"
            title={playing ? 'Tạm dừng (Space)' : 'Phát (Space)'}
          >
            {playing ? (
              <Pause size={15} className="fill-white" />
            ) : (
              <Play size={15} className="fill-white translate-x-0.5" />
            )}
          </button>
          <button
            type="button"
            aria-label="Frame tiếp"
            disabled={!ready || saving || capturing}
            onClick={() => onSeek(Math.min(duration, time + 1 / fps))}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 transition-colors"
            title="Tiến 1 frame (→)"
          >
            <SkipForward size={15} />
          </button>
        </div>

        {/* Right: Drawing Toggle Button, Volume, Speed Rate, Fullscreen */}
        <div className="flex items-center gap-2 justify-end shrink-0 flex-nowrap">
          {onToggleDrawing && (
            <button
              type="button"
              aria-label="Bật/tắt vẽ trên frame"
              aria-pressed={drawingMode}
              disabled={!ready || saving || capturing}
              onClick={onToggleDrawing}
              className={`rounded-lg border px-2.5 py-1 text-xs flex items-center gap-1.5 font-medium whitespace-nowrap transition-colors ${
                drawingMode
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              } disabled:opacity-40`}
              title={drawingMode ? 'Tắt vẽ (D)' : 'Vẽ trên frame (D)'}
            >
              <Pen size={13} />
              <span>{drawingMode ? 'Tắt vẽ' : 'Vẽ'}</span>
            </button>
          )}

          {/* Volume */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-label={volume === 0 ? 'Bật tiếng' : 'Tắt tiếng'}
              onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              aria-label="Âm lượng"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-14 sm:w-16 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Speed Selector */}
          <div className="relative shrink-0">
            <select
              value={playbackRate}
              onChange={(e) => onPlaybackRateChange(Number(e.target.value))}
              className="appearance-none pl-2 pr-5 py-1 text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer focus:outline-none"
              title="Tốc độ phát"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1.0x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2.0x</option>
            </select>
            <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Fullscreen */}
          <button
            type="button"
            aria-label="Toàn màn hình"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
            onClick={onFullscreen}
            title="Toàn màn hình"
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>

      {/* 2. Professional Timeline Tracks */}
      <div className="border border-slate-200/90 rounded-xl bg-slate-50/70 p-2.5 space-y-1.5 shadow-2xs">
        {/* Time Ruler */}
        <div className="flex items-center">
          <div className="w-20 sm:w-24 shrink-0" />
          <div className="flex-1 relative h-5 select-none">
            {rulerTicks.map((tick, idx) => (
              <div
                key={idx}
                className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                style={{ left: `${tick.percent}%` }}
              >
                <span className="text-[9px] font-mono text-slate-400 font-medium">
                  {formatTime(tick.time)}
                </span>
                <div className="w-[1px] h-1.5 bg-slate-300 mt-0.5" />
              </div>
            ))}
          </div>
        </div>

        {/* Tracks Area */}
        <div className="flex items-stretch gap-2 relative">
          {/* Track Labels Column */}
          <div className="w-20 sm:w-24 shrink-0 flex flex-col justify-between py-0.5 space-y-1.5 select-none">
            {/* Track 1 Label */}
            <div className="h-8 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 px-1">
              <div className="w-4 h-4 rounded bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <Film size={11} />
              </div>
              <span className="truncate">Video</span>
            </div>
            {/* Track 2 Label */}
            <div className="h-8 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 px-1">
              <div className="w-4 h-4 rounded bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                <Activity size={11} />
              </div>
              <span className="truncate">Âm thanh</span>
            </div>
            {/* Track 3 Label */}
            <div className="h-8 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 px-1">
              <div className="w-4 h-4 rounded bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <MessageSquare size={11} />
              </div>
              <span className="truncate">Bình luận</span>
            </div>
          </div>

          {/* Timeline Tracks Right Column */}
          <div className="flex-1 relative flex flex-col justify-between space-y-1.5">
            {/* Track 1: Video Filmstrip Track */}
            <div className="h-8 bg-slate-950 border border-purple-300/40 rounded-lg overflow-hidden flex items-center relative shadow-2xs">
              <div className="w-full h-full flex divide-x divide-black/60 overflow-hidden">
                {Array.from({ length: 48 }).map((_, i) => (
                  <div key={i} className="flex-1 h-full relative overflow-hidden bg-slate-950">
                    {thumbnails[i] ? (
                      <img
                        src={thumbnails[i]}
                        alt=""
                        className="w-full h-full object-cover pointer-events-none select-none block"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                        <Film size={9} className="text-slate-800" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Track 2: Audio Waveform Track (CapCut/Premiere Style) */}
            <div className="h-8 bg-[#0c1f36] border border-sky-900/60 rounded-lg overflow-hidden flex flex-col justify-between px-1.5 py-0.5 relative">
              {/* Audio spectrum bars */}
              <div className="w-full h-full relative flex items-center">
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 660 22">
                  {/* Subtle white/cyan baseline */}
                  <line x1="0" y1="11" x2="660" y2="11" stroke="#7dd3fc" strokeWidth="0.5" strokeOpacity="0.4" />
                  {/* Sóng âm dạng cột vạch phổ dọc */}
                  {audioBars.map((bar, i) => {
                    const x = (i / (audioBars.length - 1)) * 656 + 2
                    const top = 11 - bar.height / 2
                    const bottom = 11 + bar.height / 2
                    return (
                      <g key={i}>
                        {bar.isPeak ? (
                          <>
                            {/* Thân vạch xanh cyan */}
                            <line
                              x1={x}
                              y1={top + 2}
                              x2={x}
                              y2={bottom}
                              stroke="#0284c7"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                            {/* Chỏm peak cam như hình mẫu */}
                            <line
                              x1={x}
                              y1={top}
                              x2={x}
                              y2={top + 2}
                              stroke="#f97316"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </>
                        ) : (
                          <line
                            x1={x}
                            y1={top}
                            x2={x}
                            y2={bottom}
                            stroke="#38bdf8"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        )}
                      </g>
                    )
                  })}
                </svg>
              </div>
            </div>

            {/* Track 3: Comments Track */}
            <div className="h-8 bg-white border border-slate-200 rounded-lg flex items-center relative">
              <div aria-label="Marker bình luận" className="absolute inset-0">
                {duration > 0 &&
                  comments.map((comment) => {
                    const pos = Math.min(100, Math.max(0, (comment.timestamp / duration) * 100))
                    return (
                      <button
                        key={comment.id}
                        type="button"
                        aria-label={`${formatTime(comment.timestamp)}: ${comment.content}`}
                        title={`${formatTime(comment.timestamp)}: ${comment.content}`}
                        disabled={capturing || saving}
                        onClick={(e) => {
                          e.stopPropagation()
                          onPickComment(comment)
                        }}
                        style={{ left: `${pos}%` }}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group z-20 flex flex-col items-center cursor-pointer p-0.5 focus:outline-none"
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs transition-transform group-hover:scale-125 ${getMarkerColor(
                            comment
                          )}`}
                        />
                        <div className="w-[1.5px] h-1 bg-slate-400 group-hover:bg-blue-600" />
                      </button>
                    )
                  })}
              </div>
            </div>

            {/* Global Playhead (Kim thời gian chạy dọc từ Ruler xuyên suốt các tracks) */}
            <div
              className="absolute top-[-24px] bottom-0 pointer-events-none z-30 flex flex-col items-center -translate-x-1/2"
              style={{ left: `${percent}%` }}
            >
              <div className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono text-[9px] font-semibold shadow-sm whitespace-nowrap mb-0.5">
                {formatTime(time)}
              </div>
              <div className="w-[2px] flex-1 bg-blue-600 shadow-sm" />
            </div>

            {/* Transparent Scrubbing Overlay & Automation Compatibility */}
            <input
              aria-label="Vị trí phát video"
              type="range"
              min="0"
              max={duration || 1}
              step="0.001"
              value={Math.min(time, duration)}
              disabled={!ready || saving || capturing}
              onChange={(event) => onSeek(Number(event.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  e.preventDefault()
                  const direction = e.key === 'ArrowLeft' ? -1 : 1
                  onSeek(Math.max(0, Math.min(duration, time + direction * (e.shiftKey ? 5 : 1 / fps))))
                } else if (e.code === 'Space') {
                  e.preventDefault()
                  onTogglePlay()
                }
              }}
              className="w-full h-full opacity-0 cursor-pointer absolute inset-0 z-10"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
