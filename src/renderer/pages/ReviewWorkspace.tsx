import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize, MessageSquare, Pause, Play, Plus, SkipBack, SkipForward, Pen, Volume2 } from 'lucide-react'
import { Annotation, AnnotationType, CommentCategory, CommentPriority, CommentStatus, EditVersion, Project, ReviewComment } from '@shared/types'
import { useProjectStore } from '../stores/project.store'
import { AnnotationCanvas } from '../components/review/AnnotationCanvas'
import { DrawingToolbar } from '../components/review/DrawingToolbar'
import { VideoPlayerControls } from '../components/review/VideoPlayerControls'
import { captureFrame } from '../lib/capture-frame'
import { localFileUrl as fileUrl } from '../lib/source-media'
import { registerNavigationGuard } from '../lib/navigation-guard'

const categories: Record<CommentCategory, string> = {
  SUBTITLE: 'Phụ đề', PACING: 'Nhịp dựng', AUDIO: 'Âm thanh', COLOR: 'Màu sắc',
  CUT: 'Nhịp cắt', EFFECT: 'Hiệu ứng', GRAPHICS: 'Đồ họa', GENERAL: 'Chung'
}
const priorities: Record<CommentPriority, string> = {
  LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao', CRITICAL: 'Khẩn cấp'
}
const statuses: Record<CommentStatus, string> = {
  OPEN: 'Đang mở', IN_PROGRESS: 'Đang xử lý', FIXED: 'Đã sửa', PARTIAL: 'Sửa một phần', REJECTED: 'Từ chối'
}
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white p-2 text-xs disabled:opacity-50'
const buttonClass = 'rounded-lg border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-40'

function formatTime(seconds: number): string {
  const ms = Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * 1000))
  return `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}

export const ReviewWorkspace: React.FC = () => {
  const project = useProjectStore((state) => state.activeProject)
  if (!project) return <div className="flex-1 p-8 text-slate-500">Chọn một dự án để bắt đầu duyệt video.</div>
  return <ProjectReview key={project.id} project={project} />
}

function ProjectReview({ project }: { project: Project }): React.ReactElement {
  const setActiveTab = useProjectStore((state) => state.setActiveTab)
  const selectVersion = useProjectStore((state) => state.selectVersion)
  const initialVersionId = useProjectStore((state) => state.activeVersionId)
  const initialCommentId = useProjectStore((state) => state.reviewCommentId)
  const [versions, setVersions] = useState<EditVersion[]>([])
  const [versionId, setVersionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' ? document.getElementById('topbar-actions') : null
  )

  useLayoutEffect(() => {
    if (!portalTarget) {
      setPortalTarget(document.getElementById('topbar-actions'))
    }
  }, [portalTarget])

  useEffect(() => {
    let cancelled = false
    window.api.listVersions(project.id).then((list: EditVersion[]) => {
      if (cancelled) return
      setVersions(list)
      const chosen = list.find((version) => version.id === initialVersionId) || list[list.length - 1]
      setVersionId(chosen?.id || '')
      if (chosen && !initialVersionId) selectVersion(chosen.id)
    }).catch(() => { if (!cancelled) setError('Không thể tải phiên bản. Hãy mở lại màn hình Review.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [project.id])

  useEffect(() => {
    if (initialVersionId && versions.some((v) => v.id === initialVersionId)) {
      setVersionId(initialVersionId)
    }
  }, [initialVersionId, versions])

  const version = versions.find((item) => item.id === versionId)

  const headerActions = (
    <div className="flex items-center gap-2">
      <select
        aria-label="Phiên bản đang duyệt"
        className="rounded-lg border border-slate-200 bg-white p-2 text-xs max-w-xs cursor-pointer hover:border-slate-300 transition"
        value={versionId}
        onChange={(event) => {
          if (selectVersion(event.target.value)) setVersionId(event.target.value)
        }}
        disabled={!versions.length}
      >
        {!versions.length && <option value="">Chưa có bản dựng</option>}
        {versions.map((item) => (
          <option key={item.id} value={item.id}>
            V{item.versionNumber} — {item.name}
          </option>
        ))}
      </select>
      <button className={`${buttonClass} whitespace-nowrap`} onClick={() => setActiveTab('versions')}>
        Nhập bản dựng
      </button>
      <button className={`${buttonClass} whitespace-nowrap`} onClick={() => setActiveTab('export')}>
        Xuất phản hồi
      </button>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8fafc] text-slate-800">
      {portalTarget && createPortal(headerActions, portalTarget)}
      {loading ? (
        <p role="status" className="p-8 text-xs text-slate-500">
          Đang tải phiên bản...
        </p>
      ) : error ? (
        <p role="alert" className="p-8 text-red-600 text-xs">
          {error}
        </p>
      ) : version ? (
        <VersionReview key={version.id} project={project} version={version} initialCommentId={initialCommentId} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
          <MessageSquare />
          <p>Nhập video trong mục Phiên bản để bắt đầu review.</p>
          <button className={buttonClass} onClick={() => setActiveTab('versions')}>
            Đến Phiên bản
          </button>
        </div>
      )}
    </div>
  )
}

function VersionReview({ project, version, initialCommentId }: { project: Project; version: EditVersion; initialCommentId: string | null }): React.ReactElement {
  const refreshStats = useProjectStore((state) => state.refreshStats)
  const videoRef = useRef<HTMLVideoElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const mounted = useRef(true)
  const busy = useRef(false)
  const initialSeekDone = useRef(false)
  const pendingSeek = useRef<number | null>(null)
  const canvasRef = useRef<{ getAnnotatedBase64: () => string | null }>(null)
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mediaError, setMediaError] = useState('')
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState('ALL')
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({
    width: version.width || 1920,
    height: version.height || 1080
  })
  const isVertical = videoDimensions.height > videoDimensions.width

  useEffect(() => {
    if (version.width && version.height) {
      setVideoDimensions({ width: version.width, height: version.height })
    }
  }, [version.width, version.height])
  const [draftTime, setDraftTime] = useState<number | null>(null)
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<CommentCategory>('GENERAL')
  const [priority, setPriority] = useState<CommentPriority>('MEDIUM')
  const [saving, setSaving] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [frame, setFrame] = useState<string | null>(null)
  const [history, setHistory] = useState<Annotation[][]>([[]])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [tool, setTool] = useState<AnnotationType>('ARROW')
  const [color, setColor] = useState('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [fontSize, setFontSize] = useState(24)
  const [text, setText] = useState('')
  const [drawingMode, setDrawingMode] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [seeking, setSeeking] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [leftWidth, setLeftWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('frameflow_review_left_width')
      const num = saved ? Number(saved) : 320
      return Number.isFinite(num) && num >= 220 && num <= 600 ? num : 320
    } catch {
      return 320
    }
  })
  const [isResizingLeft, setIsResizingLeft] = useState(false)

  const [rightWidth, setRightWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('frameflow_review_right_width')
      const num = saved ? Number(saved) : 320
      return Number.isFinite(num) && num >= 260 && num <= 600 ? num : 320
    } catch {
      return 320
    }
  })
  const [isResizingRight, setIsResizingRight] = useState(false)

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  const handleLeftResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsResizingLeft(true)
    const startX = e.clientX
    const startWidth = leftWidth

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX
      const maxW = Math.max(360, Math.min(640, window.innerWidth - 450))
      const newWidth = Math.min(maxW, Math.max(220, Math.round(startWidth + delta)))
      setLeftWidth(newWidth)
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setIsResizingLeft(false)
      const finalDelta = upEvent.clientX - startX
      const maxW = Math.max(360, Math.min(640, window.innerWidth - 450))
      const finalWidth = Math.min(maxW, Math.max(220, Math.round(startWidth + finalDelta)))
      try {
        localStorage.setItem('frameflow_review_left_width', String(finalWidth))
      } catch {}
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const handleRightResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsResizingRight(true)
    const startX = e.clientX
    const startWidth = rightWidth

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = startX - moveEvent.clientX
      const maxW = Math.max(360, Math.min(640, window.innerWidth - 450))
      const newWidth = Math.min(maxW, Math.max(260, Math.round(startWidth + delta)))
      setRightWidth(newWidth)
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setIsResizingRight(false)
      const finalDelta = startX - upEvent.clientX
      const maxW = Math.max(360, Math.min(640, window.innerWidth - 450))
      const finalWidth = Math.min(maxW, Math.max(260, Math.round(startWidth + finalDelta)))
      try {
        localStorage.setItem('frameflow_review_right_width', String(finalWidth))
      } catch {}
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const baseline = useRef('')
  const annotations = history[historyIndex]
  const changeAnnotations = (next: Annotation[]) => {
    setHistory((items) => [...items.slice(0, historyIndex + 1), next])
    setHistoryIndex(historyIndex + 1)
  }
  const selected = comments.find((item) => item.id === selectedId)
  const visibleComments = comments.filter((item) => filter === 'ALL' || item.status === filter)
  const frameIndex = (timestamp: number) => Math.round(timestamp * (version.fps || 30))
  const fps = version.fps && version.fps > 0 ? version.fps : 30
  const isNearTime = (t1: number, t2: number) => Math.abs(t1 - t2) <= Math.max(1.5 / fps, 0.08)
  const onFrame = comments.filter((comment) => isNearTime(comment.timestamp, time) || Math.abs(frameIndex(comment.timestamp) - frameIndex(time)) <= 1)
  const activeComment = (selected && (isNearTime(selected.timestamp, time) || Math.abs(selected.timestamp - time) < 0.25))
    ? selected
    : (onFrame.find((comment) => comment.id === selectedId) || onFrame[0])
  const activeAttachment = activeComment?.attachments?.find((attachment) => attachment.type === 'FRAME')
  const savedFrame = activeAttachment ? fileUrl(/^(?:[A-Za-z]:|\/)/.test(activeAttachment.filePath) ? activeAttachment.filePath : `${project.projectPath}/${activeAttachment.filePath}`) : null
  const selectedAttachment = selected?.attachments?.find((attachment) => attachment.type === 'FRAME')
  const selectedSavedFrame = selectedAttachment ? fileUrl(/^(?:[A-Za-z]:|\/)/.test(selectedAttachment.filePath) ? selectedAttachment.filePath : `${project.projectPath}/${selectedAttachment.filePath}`) : null
  const signature = (value: Annotation[], note: string, cat = category, prio = priority) => JSON.stringify({ content: note, category: cat, priority: prio, annotations: value.map((annotation) => ({ type: annotation.type, data: annotation.data })) })
  const dirty = draftTime !== null && signature(annotations, content) !== baseline.current
  const cancelDraft = () => {
    setDraftTime(null)
    setFrame(null)
    setEditingId(null)
    setDrawingMode(false)
    setHistory([[]])
    setHistoryIndex(0)
    setContent('')
  }
  const leaveDraft = () => {
    if (saving || capturing || busy.current) return false
    if (dirty && !window.confirm('Frame này có hình vẽ/ghi chú chưa lưu. Bỏ thay đổi và chuyển tiếp?')) return false
    if (draftTime !== null) cancelDraft()
    return true
  }
  useEffect(() => registerNavigationGuard(leaveDraft))
  useEffect(() => {
    if (playing || seeking || draftTime !== null) return
    if (!selectedId && onFrame.length > 0) {
      setSelectedId(onFrame[0].id)
    } else if (selectedId && selected && Math.abs(selected.timestamp - time) > 0.35 && !onFrame.some((c) => c.id === selectedId)) {
      setSelectedId(onFrame[0]?.id || null)
    }
  }, [time, playing, seeking, draftTime, onFrame, selectedId, selected])
  const syncDuration = (video: HTMLVideoElement) => {
    const value = video.duration
    // Some WebM containers initially report Infinity and become finite only
    // after more data is decoded. Keep the imported duration usable meanwhile.
    setDuration(Number.isFinite(value) && value > 0 ? value : Math.max(0, version.duration || 0))
    if (video.videoWidth && video.videoHeight) {
      setVideoDimensions({ width: video.videoWidth, height: video.videoHeight })
    }
  }

  useEffect(() => {
    mounted.current = true
    window.api.listComments(project.id, version.id).then((list: ReviewComment[]) => {
      if (mounted.current) setComments(list)
    }).catch(() => { if (mounted.current) setError('Không thể tải bình luận. Hãy mở lại phiên bản.') })
      .finally(() => { if (mounted.current) setLoading(false) })
    return () => { mounted.current = false }
  }, [project.id, version.id])

  useEffect(() => {
    if (!initialCommentId || initialSeekDone.current || !ready || !videoRef.current) return
    const comment = comments.find((item) => item.id === initialCommentId)
    if (!comment) return
    initialSeekDone.current = true
    setSelectedId(comment.id)
    videoRef.current.pause()
    videoRef.current.currentTime = Math.max(0, Math.min(duration || comment.timestamp, comment.timestamp))
  }, [initialCommentId, comments, ready, duration])

  const seek = (target: number, checked = false) => {
    const video = videoRef.current
    if (!video || (!checked && !leaveDraft())) return
    if (!checked && selected && Math.abs(target - selected.timestamp) > 0.15) {
      setSelectedId(null)
    }
    if (!ready) { pendingSeek.current = target; return }
    video.pause()
    video.currentTime = Math.max(0, Math.min(duration, target))
    setTime(video.currentTime)
  }

  useEffect(() => {
    if (!ready || pendingSeek.current === null || !videoRef.current) return
    videoRef.current.currentTime = Math.max(0, Math.min(duration || pendingSeek.current, pendingSeek.current))
    pendingSeek.current = null
  }, [ready, duration])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video || !ready || !leaveDraft()) return
    if (video.paused) void video.play().catch(() => setMediaError('Không phát được video. Kiểm tra tệp hoặc dùng MP4 H.264.'))
    else video.pause()
  }

  const startComment = async (draw = false) => {
    const video = videoRef.current
    if (!video || !ready || video.seeking || draftTime !== null || busy.current || loading) return
    video.pause()
    busy.current = true
    setCapturing(true)
    setDraftTime(video.currentTime)
    setEditingId(null)
    setDrawingMode(true)
    setFrame(null)
    setHistory([[]])
    setHistoryIndex(0)
    setContent('')
    baseline.current = signature([], '')
    setSelectedId(null)
    setError('')
    try {
      const captured = await captureFrame(video)
      if (!mounted.current) return
      setFrame(captured.base64)
      setDraftTime(captured.timestamp)
      setTime(captured.timestamp)
      if (Math.abs(video.currentTime - captured.timestamp) > 0.0001) video.currentTime = captured.timestamp
      if (!draw) textRef.current?.focus()
    } catch (err) {
      if (mounted.current) {
        setDraftTime(null)
        setError(err instanceof Error ? err.message : 'Không thể chụp frame.')
      }
    } finally {
      busy.current = false
      if (mounted.current) setCapturing(false)
    }
  }

  const editDrawing = (comment: ReviewComment) => {
    if (!leaveDraft()) return
    const attachment = comment.attachments?.find((item) => item.type === 'FRAME')
    if (!attachment) { setError('Bình luận này chưa có frame gốc để sửa hình vẽ.'); return }
    videoRef.current?.pause()
    seek(comment.timestamp, true)
    const original = /^(?:[A-Za-z]:|\/)/.test(attachment.filePath) ? attachment.filePath : `${project.projectPath}/${attachment.filePath}`
    setFrame(fileUrl(original))
    setDraftTime(comment.timestamp)
    setEditingId(comment.id)
    setSelectedId(comment.id)
    setContent(comment.content)
    setCategory(comment.category)
    setPriority(comment.priority)
    setHistory([comment.annotations || []])
    setHistoryIndex(0)
    baseline.current = signature(comment.annotations || [], comment.content, comment.category, comment.priority)
    setDrawingMode(true)
    setError('')
  }

  const toggleDrawing = () => {
    if (saving || capturing) return
    if (draftTime !== null) { setDrawingMode((value) => !value); return }
    if (activeComment && savedFrame && !playing) editDrawing(activeComment)
    else void startComment(true)
  }

  const chooseTool = (next: AnnotationType) => {
    setTool(next)
    if (draftTime !== null) setDrawingMode(true)
    else if (activeComment && savedFrame && !playing) editDrawing(activeComment)
    else void startComment(true)
  }

  const saveComment = async () => {
    if (draftTime === null || !frame || (!content.trim() && !annotations.length) || busy.current) return
    busy.current = true
    setSaving(true)
    setError('')
    try {
      const annotatedFrameBase64 = annotations.length ? canvasRef.current?.getAnnotatedBase64() : undefined
      if (annotations.length && !annotatedFrameBase64) throw new Error('Annotation chưa sẵn sàng')
      const note = content.trim() || `Chú thích frame ~${frameIndex(draftTime)} tại ${formatTime(draftTime)}`
      const comment: ReviewComment = editingId ? await window.api.updateComment({
        projectId: project.id, editVersionId: version.id, commentId: editingId,
        category, priority, content: note, annotations, annotatedFrameBase64: annotatedFrameBase64 || undefined
      }) : await window.api.createComment({
        projectId: project.id, editVersionId: version.id, timestamp: draftTime,
        frameNumber: frameIndex(draftTime), category, priority, content: note,
        frameBase64: frame, annotations, annotatedFrameBase64: annotatedFrameBase64 || undefined
      })
      if (!mounted.current) return
      setComments((list) => [...list.filter((item) => item.id !== comment.id), comment].sort((a, b) => a.timestamp - b.timestamp))
      setSelectedId(comment.id)
      setTime(comment.timestamp)
      if (videoRef.current && Math.abs(videoRef.current.currentTime - comment.timestamp) > 0.001) {
        videoRef.current.currentTime = comment.timestamp
      }
      setFilter('ALL')
      setDraftTime(null)
      setContent('')
      setFrame(null)
      setHistory([[]])
      setHistoryIndex(0)
      setDrawingMode(false)
      setEditingId(null)
      await refreshStats()
    } catch {
      if (mounted.current) setError('Không thể lưu bình luận. Nội dung vẫn được giữ để thử lại.')
    } finally {
      busy.current = false
      if (mounted.current) setSaving(false)
    }
  }

  const updateStatus = async (status: CommentStatus) => {
    if (!selected || busy.current) return
    busy.current = true
    setSaving(true)
    setError('')
    try {
      await window.api.updateCommentStatus({ projectId: project.id, commentId: selected.id, status })
      if (!mounted.current) return
      setComments((list) => list.map((item) => item.id === selected.id ? { ...item, status } : item))
      await refreshStats()
    } catch {
      if (mounted.current) setError('Không thể cập nhật trạng thái. Vui lòng thử lại.')
    } finally {
      busy.current = false
      if (mounted.current) setSaving(false)
    }
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      const target = event.target as HTMLElement | null
      const isTextInput = target?.closest('input:not([type="range"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]')
      const isSelect = target?.closest('select')
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && draftTime !== null) {
        event.preventDefault()
        void saveComment()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && draftTime !== null && !isTextInput && !saving) {
        event.preventDefault()
        setHistoryIndex((index) => event.shiftKey ? Math.min(history.length - 1, index + 1) : Math.max(0, index - 1))
        return
      }
      if (!isTextInput && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'd') { event.preventDefault(); toggleDrawing(); return }
      if (isTextInput || isSelect || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === 'Escape') { leaveDraft(); return }
      if (draftTime !== null) {
        const choice: Record<string, CommentPriority> = { '1': 'LOW', '2': 'MEDIUM', '3': 'HIGH' }
        if (choice[event.key]) setPriority(choice[event.key])
        if (choice[event.key]) return
      }
      if (event.code === 'Space') { event.preventDefault(); togglePlay() }
      else if (event.key.toLowerCase() === 'c') { event.preventDefault(); void startComment() }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const direction = event.key === 'ArrowLeft' ? -1 : 1
        seek((videoRef.current?.currentTime || 0) + direction * (event.shiftKey ? 5 : 1 / (version.fps || 30)))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  const pickComment = (comment: ReviewComment) => {
    if (!leaveDraft()) return
    setSelectedId(comment.id)
    seek(comment.timestamp, true)
  }

  return (
    <>
      {error && <p role="alert" className="p-3 text-xs text-red-700 bg-red-50">{error}</p>}
      <div className="flex-1 flex min-h-0 overflow-x-auto">
        <aside
          style={{ width: `${leftWidth}px` }}
          className="shrink-0 border-r border-slate-200 bg-white flex flex-col relative"
        >
          <div className="p-4 border-b space-y-3"><h2 className="text-sm font-bold">Bình luận ({comments.length})</h2>
            <select aria-label="Lọc trạng thái bình luận" className={inputClass} value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="ALL">Tất cả trạng thái</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? <p role="status" className="text-xs text-slate-500">Đang tải bình luận...</p> : !visibleComments.length && <p className="text-xs text-slate-500">Chưa có bình luận{filter === 'ALL' ? '. Nhấn C để thêm.' : ' phù hợp bộ lọc.'}</p>}
            {visibleComments.map((comment) => {
              const attach = comment.attachments?.find((item) => item.type === 'ANNOTATED_FRAME') || comment.attachments?.find((item) => item.type === 'FRAME')
              const thumbUrl = attach ? fileUrl(/^(?:[A-Za-z]:|\/)/.test(attach.filePath) ? attach.filePath : `${project.projectPath}/${attach.filePath}`) : null
              return (
                <button
                  key={comment.id}
                  disabled={capturing || saving}
                  onClick={() => pickComment(comment)}
                  className={`w-full text-left p-3 rounded-xl border space-y-2 disabled:opacity-50 transition ${selectedId === comment.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className="flex gap-2.5 items-start">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt="" className={`${isVertical ? 'w-10 h-16' : 'w-14 h-10'} rounded-lg object-cover shrink-0 bg-black border border-slate-200`} />
                    ) : (
                      <div className={`${isVertical ? 'w-10 h-16' : 'w-14 h-10'} rounded-lg bg-slate-100 shrink-0 flex items-center justify-center text-slate-400 border border-slate-200`}>
                        <MessageSquare size={16} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-mono text-blue-600 font-semibold">{formatTime(comment.timestamp)}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{comment.id}</span>
                      </div>
                      <p className="text-xs break-words line-clamp-2 text-slate-700 mt-0.5">{comment.content}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span>{categories[comment.category]}</span>
                    <span>{priorities[comment.priority]}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${comment.status === 'FIXED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{statuses[comment.status]}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Kéo để điều chỉnh độ rộng danh sách bình luận (nhấp đúp để đặt lại mặc định)"
          title="Kéo để thay đổi kích thước · Nhấp đúp để đặt lại mặc định (320px)"
          onPointerDown={handleLeftResizeStart}
          onDoubleClick={() => {
            setLeftWidth(320)
            try {
              localStorage.setItem('frameflow_review_left_width', '320')
            } catch {}
          }}
          className={`w-1 cursor-col-resize relative z-20 transition-colors shrink-0 group select-none ${
            isResizingLeft ? 'bg-blue-500' : 'bg-transparent hover:bg-blue-500/40'
          }`}
          style={{ marginLeft: '-1px', marginRight: '-1px' }}
        >
          <div className={`absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize ${isResizingLeft ? 'bg-blue-500/20' : 'group-hover:bg-blue-500/10'}`} />
        </div>
        <main className="flex-1 min-w-[320px] flex flex-col">
          <div className="p-2.5 sm:p-3 bg-white border-b border-slate-200 shrink-0 space-y-2" aria-label="Công cụ vẽ trên video">
            <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono">Frame ~{frameIndex(draftTime ?? time)} · {formatTime(draftTime ?? time)} · {version.name}</span>
                {draftTime !== null && (
                  <span className="text-slate-400 font-mono text-[11px]">
                    · {annotations.length} hình {dirty ? '(Chưa lưu)' : ''}{editingId ? ` · Sửa ${editingId}` : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {draftTime !== null && (
                  <>
                    <button className={buttonClass} disabled={saving || capturing || !annotations.length} onClick={() => changeAnnotations([])}>
                      Xóa tất cả hình
                    </button>
                    <button className={buttonClass} disabled={saving || capturing} onClick={() => { leaveDraft() }}>
                      Hủy vẽ
                    </button>
                    <button
                      className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}
                      disabled={saving || capturing || !frame || (!annotations.length && !content.trim())}
                      onClick={() => { void saveComment() }}
                    >
                      {editingId ? 'Lưu thay đổi frame' : 'Lưu chú thích frame'}
                    </button>
                  </>
                )}
                <button
                  aria-label="Bật/tắt vẽ trên frame"
                  aria-pressed={drawingMode}
                  disabled={!ready || loading || capturing || saving || seeking}
                  className={`${buttonClass} flex items-center gap-1 ${drawingMode ? 'bg-blue-50 text-blue-700' : ''}`}
                  onClick={toggleDrawing}
                >
                  <Pen size={14} />
                  {drawingMode ? 'Tắt vẽ (D)' : 'Vẽ trên frame (D)'}
                </button>
              </div>
            </div>
            <fieldset disabled={!ready || loading || saving || capturing || seeking}>
              <DrawingToolbar
                currentTool={tool}
                setCurrentTool={chooseTool}
                currentColor={color}
                setCurrentColor={setColor}
                strokeWidth={strokeWidth}
                setStrokeWidth={setStrokeWidth}
                fontSize={fontSize}
                setFontSize={setFontSize}
                onUndo={() => setHistoryIndex((index) => Math.max(0, index - 1))}
                onRedo={() => setHistoryIndex((index) => Math.min(history.length - 1, index + 1))}
                canUndo={draftTime !== null && historyIndex > 0}
                canRedo={draftTime !== null && historyIndex < history.length - 1}
              />
            </fieldset>
          </div>
          <div className="flex-1 min-h-0 bg-slate-950 flex items-center justify-center relative overflow-hidden select-none">
            <div
              className={`relative flex items-center justify-center h-full ${
                isVertical
                  ? 'bg-black overflow-hidden'
                  : 'w-full bg-black overflow-hidden'
              }`}
              style={
                isVertical
                  ? {
                      aspectRatio: `${videoDimensions.width} / ${videoDimensions.height}`,
                      height: '100%',
                      maxHeight: '100%',
                      maxWidth: '100%'
                    }
                  : undefined
              }
            >
              <video key={version.id} ref={videoRef} src={fileUrl(version.videoPath)} preload="metadata" className="w-full h-full object-contain bg-black" onClick={togglePlay}
                onLoadedMetadata={(event) => syncDuration(event.currentTarget)}
                onDurationChange={(event) => syncDuration(event.currentTarget)}
                onLoadedData={() => { setReady(true); setMediaError('') }}
                onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
                onSeeking={() => setSeeking(true)}
                onSeeked={(event) => { setTime(event.currentTarget.currentTime); setSeeking(false) }}
                onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
                onError={() => { setReady(false); setPlaying(false); setMediaError('Không mở được video. Tệp có thể đã bị di chuyển hoặc codec không được hỗ trợ. Hãy thử MP4 H.264.') }} />
              {frame && draftTime !== null ? <div className={`absolute inset-0 bg-black ${drawingMode ? '' : 'pointer-events-none'}`}>
                <AnnotationCanvas ref={canvasRef} fit="player" imageSrc={frame} annotations={annotations} onAnnotationsChange={changeAnnotations} currentTool={tool} currentColor={color} strokeWidth={strokeWidth} fontSize={fontSize} textContent={text} onTextContentChange={setText} readOnly={!drawingMode || saving} />
              </div> : !playing && !seeking && savedFrame && activeComment ? <div className="absolute inset-0 bg-black pointer-events-none">
                <AnnotationCanvas key={activeComment.id} fit="player" imageSrc={savedFrame} annotations={activeComment.annotations || []} currentTool={tool} currentColor={color} strokeWidth={strokeWidth} readOnly />
              </div> : null}
            </div>
            {mediaError && <p role="alert" className="absolute inset-x-8 p-4 rounded-xl bg-white text-red-700 text-xs shadow-lg">{mediaError}</p>}
          </div>
          <VideoPlayerControls
            time={time}
            duration={duration}
            fps={version.fps || 30}
            playing={playing}
            volume={volume}
            ready={ready}
            saving={saving}
            capturing={capturing}
            comments={comments}
            playbackRate={playbackRate}
            videoSrc={fileUrl(version.videoPath)}
            onSeek={seek}
            onTogglePlay={togglePlay}
            onVolumeChange={(val) => {
              setVolume(val)
              if (videoRef.current) videoRef.current.volume = val
            }}
            onPlaybackRateChange={(rate) => {
              setPlaybackRate(rate)
              if (videoRef.current) videoRef.current.playbackRate = rate
            }}
            onFullscreen={() => {
              void videoRef.current?.requestFullscreen().catch(() => setError('Không thể bật toàn màn hình.'))
            }}
            onPickComment={pickComment}
          />
        </main>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Kéo để điều chỉnh độ rộng ghi chú duyệt (nhấp đúp để đặt lại mặc định)"
          title="Kéo để thay đổi kích thước · Nhấp đúp để đặt lại mặc định (320px)"
          onPointerDown={handleRightResizeStart}
          onDoubleClick={() => {
            setRightWidth(320)
            try {
              localStorage.setItem('frameflow_review_right_width', '320')
            } catch {}
          }}
          className={`w-1 cursor-col-resize relative z-20 transition-colors shrink-0 group select-none ${
            isResizingRight ? 'bg-blue-500' : 'bg-transparent hover:bg-blue-500/40'
          }`}
          style={{ marginLeft: '-1px', marginRight: '-1px' }}
        >
          <div className={`absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize ${isResizingRight ? 'bg-blue-500/20' : 'group-hover:bg-blue-500/10'}`} />
        </div>
        <aside
          style={{ width: `${rightWidth}px` }}
          className="shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4 space-y-4"
        >
          <h2 className="font-bold text-sm">Ghi chú duyệt</h2>
          {draftTime !== null ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveComment() }}>
            <p className="font-mono text-xs">{formatTime(draftTime)} · Frame ~{Math.round(draftTime * (version.fps || 30))}</p>
            <label className="block text-xs space-y-1"><span>Danh mục</span><select className={inputClass} value={category} disabled={saving} onChange={(event) => setCategory(event.target.value as CommentCategory)}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block text-xs space-y-1"><span>Mức ưu tiên</span><select className={inputClass} value={priority} disabled={saving} onChange={(event) => setPriority(event.target.value as CommentPriority)}>{Object.entries(priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block text-xs space-y-1"><span>Nội dung phản hồi (có thể để trống nếu đã vẽ)</span><textarea ref={textRef} className={inputClass} rows={4} value={content} disabled={saving} onChange={(event) => setContent(event.target.value)} /></label>
            {capturing && <p role="status" className="text-xs text-slate-500">Đang chụp frame...</p>}
            {frame && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">Hình vẽ trên frame</span>
                  <span className="text-slate-500 font-mono">{annotations.length} nét vẽ</span>
                </div>
                <div
                  className={`rounded-xl overflow-hidden border border-slate-200 bg-black flex items-center justify-center mx-auto ${
                    isVertical ? 'aspect-[9/16] max-h-[340px] w-auto' : 'aspect-video w-full'
                  }`}
                  style={
                    isVertical && videoDimensions.width && videoDimensions.height
                      ? { aspectRatio: `${videoDimensions.width} / ${videoDimensions.height}` }
                      : undefined
                  }
                >
                  <AnnotationCanvas
                    fit="preview"
                    imageSrc={frame}
                    annotations={annotations}
                    currentTool={tool}
                    currentColor={color}
                    strokeWidth={strokeWidth}
                    readOnly
                  />
                </div>
              </div>
            )}
            <div className="flex gap-2"><button type="button" className={buttonClass} disabled={saving || capturing} onClick={() => { leaveDraft() }}>Hủy</button><button type="submit" disabled={saving || capturing || !frame || (!content.trim() && !annotations.length)} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>{saving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Lưu bình luận'}</button></div>
          </form> : <>
            <button className={`${buttonClass} flex items-center gap-2`} disabled={!ready || loading || saving} onClick={() => { void startComment() }}><Plus size={14} />Thêm bình luận (C)</button>
            {selected ? <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center">
                <p className="font-mono text-blue-600 font-semibold">{selected.id} · {formatTime(selected.timestamp)}</p>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 font-medium">{statuses[selected.status]}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Danh mục & Mức ưu tiên</span>
                <p className="font-medium">{categories[selected.category]} · {priorities[selected.priority]}</p>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Nội dung phản hồi</span>
                <p className="whitespace-pre-wrap break-words leading-relaxed mt-1 text-slate-800">{selected.content}</p>
              </div>

              {selectedSavedFrame ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-700">Hình vẽ trên frame</span>
                    <span className="text-slate-500 font-mono">{selected.annotations?.length || 0} nét vẽ</span>
                  </div>
                  <div
                    className={`rounded-xl overflow-hidden border border-slate-200 bg-black flex items-center justify-center mx-auto ${
                      isVertical ? 'aspect-[9/16] max-h-[340px] w-auto' : 'aspect-video w-full'
                    }`}
                    style={
                      isVertical && videoDimensions.width && videoDimensions.height
                        ? { aspectRatio: `${videoDimensions.width} / ${videoDimensions.height}` }
                        : undefined
                    }
                  >
                    <AnnotationCanvas
                      key={selected.id}
                      fit="preview"
                      imageSrc={selectedSavedFrame}
                      annotations={selected.annotations || []}
                      currentTool="ARROW"
                      currentColor="#ef4444"
                      strokeWidth={4}
                      readOnly
                    />
                  </div>
                  <button className={`${buttonClass} w-full flex items-center justify-center gap-1.5`} disabled={saving || capturing} onClick={() => editDrawing(selected)}>
                    <Pen size={14} /> Sửa hình vẽ trên frame
                  </button>
                </div>
              ) : (
                <p className="text-slate-400 italic">Bình luận cũ chưa có frame đính kèm.</p>
              )}

              <label className="block space-y-1">
                <span className="text-slate-500 text-[11px]">Trạng thái phản hồi</span>
                <select className={inputClass} disabled={saving} value={selected.status} onChange={(event) => { void updateStatus(event.target.value as CommentStatus) }}>
                  {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <p className="text-slate-400 text-[10px]">{new Date(selected.createdAt).toLocaleString('vi-VN')}</p>
            </div> : <p className="text-xs text-slate-500">Dừng/step video tới frame cần đánh dấu, chọn công cụ vẽ phía trên khung video hoặc nhấn D. {onFrame.length > 0 ? `Frame này có ${onFrame.length} ghi chú đã lưu.` : ''}</p>}
          </>}
        </aside>
      </div>
    </>
  )
}
