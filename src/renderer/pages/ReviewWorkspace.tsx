import React, { useEffect, useRef, useState } from 'react'
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Plus,
  MessageSquare,
  Clock,
  Trash2,
  CheckCircle2,
  Sparkles,
  Volume2,
  Maximize2
} from 'lucide-react'
import { useProjectStore } from '../stores/project.store'
import {
  Annotation,
  AnnotationType,
  CommentCategory,
  CommentPriority,
  CommentStatus,
  CreateCommentDTO,
  EditVersion,
  ReviewComment
} from '@shared/types'
import { AnnotationCanvas } from '../components/review/AnnotationCanvas'
import { DrawingToolbar } from '../components/review/DrawingToolbar'

export const ReviewWorkspace: React.FC = () => {
  const { activeProject, refreshStats, setActiveTab } = useProjectStore()

  // Versions
  const [versions, setVersions] = useState<EditVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<EditVersion | null>(null)

  // Comments
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [activeComment, setActiveComment] = useState<ReviewComment | null>(null)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'FIXED'>('ALL')

  // Video Player state
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // New Comment Creation / Annotation state
  const [isCreatingComment, setIsCreatingComment] = useState(false)
  const [newCommentText, setNewCommentText] = useState('')
  const [newCategory, setNewCategory] = useState<CommentCategory>('SUBTITLE')
  const [newPriority, setNewPriority] = useState<CommentPriority>('HIGH')
  const [capturedFrameBase64, setCapturedFrameBase64] = useState<string | null>(null)
  const [inProgressAnnotations, setInProgressAnnotations] = useState<Annotation[]>([])

  // Drawing Tools
  const [currentTool, setCurrentTool] = useState<AnnotationType>('ARROW')
  const [currentColor, setCurrentColor] = useState<string>('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState<number>(3)
  const annotationCanvasRef = useRef<{ getAnnotatedBase64: () => string | null }>(null)

  // 1. Load Versions
  const loadVersions = async () => {
    if (!activeProject) return
    const list = await window.api.listVersions(activeProject.id)
    setVersions(list)
    if (list.length > 0 && !selectedVersion) {
      setSelectedVersion(list[list.length - 1])
    }
  }

  // 2. Load Comments for active version
  const loadComments = async (versionId: string) => {
    if (!activeProject) return
    const list = await window.api.listComments(activeProject.id, versionId)
    setComments(list)
  }

  useEffect(() => {
    loadVersions()
  }, [activeProject])

  useEffect(() => {
    if (selectedVersion) {
      loadComments(selectedVersion.id)
      setActiveComment(null)
      setIsCreatingComment(false)
      if (videoRef.current) {
        videoRef.current.currentTime = 0
      }
    }
  }, [selectedVersion])

  // Video Time Update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  // Play / Pause
  const togglePlay = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  // Step Frame
  const stepFrame = (frames: number) => {
    if (!videoRef.current) return
    videoRef.current.pause()
    setIsPlaying(false)
    const fps = selectedVersion?.fps || 30
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + frames / fps))
  }

  // Skip seconds
  const skipSeconds = (seconds: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds))
  }

  // Seek Video
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  // Capture Frame from Video
  const captureCurrentFrame = (): string | null => {
    if (!videoRef.current) return null
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth || 1920
    canvas.height = videoRef.current.videoHeight || 1080
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  }

  // Trigger Create Comment
  const handleStartComment = () => {
    if (!videoRef.current || !selectedVersion) return
    videoRef.current.pause()
    setIsPlaying(false)

    const frameBase64 = captureCurrentFrame()
    setCapturedFrameBase64(frameBase64)
    setInProgressAnnotations([])
    setIsCreatingComment(true)
    setActiveComment(null)
  }

  // Save Comment
  const handleSaveComment = async () => {
    if (!activeProject || !selectedVersion || !newCommentText.trim()) return

    const annotatedBase64 = annotationCanvasRef.current?.getAnnotatedBase64() || undefined

    const dto: CreateCommentDTO = {
      projectId: activeProject.id,
      editVersionId: selectedVersion.id,
      timestamp: currentTime,
      frameNumber: Math.round(currentTime * (selectedVersion.fps || 30)),
      category: newCategory,
      priority: newPriority,
      content: newCommentText.trim(),
      frameBase64: capturedFrameBase64 || undefined,
      annotations: inProgressAnnotations,
      annotatedFrameBase64: annotatedBase64
    }

    try {
      const created = await window.api.createComment(dto)
      await loadComments(selectedVersion.id)
      await refreshStats()
      setIsCreatingComment(false)
      setNewCommentText('')
      setCapturedFrameBase64(null)
      setInProgressAnnotations([])
      setActiveComment(created)
    } catch (err) {
      console.error(err)
    }
  }

  // Update Comment Status
  const handleUpdateStatus = async (commentId: string, status: CommentStatus) => {
    if (!activeProject || !selectedVersion) return
    await window.api.updateCommentStatus({
      projectId: activeProject.id,
      commentId,
      status
    })
    await loadComments(selectedVersion.id)
    await refreshStats()
    if (activeComment && activeComment.id === commentId) {
      setActiveComment({ ...activeComment, status })
    }
  }

  // Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    if (!activeProject || !selectedVersion) return
    await window.api.deleteComment(activeProject.id, commentId)
    await loadComments(selectedVersion.id)
    await refreshStats()
    if (activeComment?.id === commentId) {
      setActiveComment(null)
    }
  }

  // Keyboard Shortcuts (Space, C, Left, Right)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault()
          handleSaveComment()
        }
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        handleStartComment()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (e.shiftKey) skipSeconds(-5)
        else stepFrame(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (e.shiftKey) skipSeconds(5)
        else stepFrame(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, duration, currentTime, selectedVersion, newCommentText, inProgressAnnotations, capturedFrameBase64])

  if (!activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
        Vui lòng chọn hoặc tạo dự án trước.
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <MessageSquare className="w-12 h-12 text-slate-600" />
        <h2 className="text-base font-bold text-white">Chưa có phiên bản video nào để duyệt</h2>
        <p className="text-xs text-slate-400 max-w-sm">
          Hãy import bản dựng video đầu tiên (Draft V1) để kích hoạt không gian Review Workspace.
        </p>
        <button
          onClick={() => setActiveTab('versions')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow transition"
        >
          Import bản dựng ngay
        </button>
      </div>
    )
  }

  const filteredComments = comments.filter((c) => {
    if (statusFilter === 'OPEN') return c.status !== 'FIXED'
    if (statusFilter === 'FIXED') return c.status === 'FIXED'
    return true
  })

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    const ms = Math.floor((secs % 1) * 1000)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ============================================================ */}
      {/* 1. LEFT PANEL: Comments List (300px) */}
      {/* ============================================================ */}
      <div className="w-80 bg-[#161b22] border-r border-[#21262d] flex flex-col shrink-0 select-none">
        {/* Panel Header */}
        <div className="p-4 border-b border-[#21262d] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <span>Bình luận ({filteredComments.length})</span>
            </h2>
            <button
              onClick={handleStartComment}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm (C)</span>
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex bg-[#0d1117] p-0.5 rounded-lg border border-[#21262d] text-xs">
            {(['ALL', 'OPEN', 'FIXED'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`flex-1 py-1 text-center font-medium rounded transition ${
                  statusFilter === filter
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter === 'ALL' ? 'Tất cả' : filter === 'OPEN' ? 'Đang mở' : 'Đã sửa'}
              </button>
            ))}
          </div>
        </div>

        {/* Comments Scrollable List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredComments.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-xs text-slate-500 border border-dashed border-[#21262d] rounded-lg">
              <p>Chưa có feedback nào</p>
              <p className="text-[10px] text-slate-600 mt-1">
                Dừng video tại điểm cần sửa và bấm "Thêm (C)"
              </p>
            </div>
          ) : (
            filteredComments.map((c) => {
              const isSelected = activeComment?.id === c.id
              const frameAttachment = c.attachments?.find((a) => a.type === 'FRAME' || a.type === 'ANNOTATED_FRAME')
              const frameImgUrl = frameAttachment
                ? `file:///${activeProject.projectPath.replace(/\\/g, '/')}/${frameAttachment.filePath.replace(/\\/g, '/')}`
                : null

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveComment(c)
                    setIsCreatingComment(false)
                    handleSeek(c.timestamp)
                  }}
                  className={`p-3 rounded-xl border transition cursor-pointer flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-blue-600/10 border-blue-500'
                      : 'bg-[#0d1117] border-[#21262d] hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-400">
                      {formatTime(c.timestamp)}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 font-bold rounded uppercase ${
                        c.status === 'FIXED'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {c.status === 'FIXED' ? 'ĐÃ SỬA' : 'ĐANG MỞ'}
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    {frameImgUrl && (
                      <img
                        src={frameImgUrl}
                        alt="frame"
                        className="w-14 h-9 object-cover rounded bg-black border border-[#30363d] shrink-0"
                      />
                    )}
                    <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                      {c.content}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-[#21262d]">
                    <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                      {c.category}
                    </span>
                    <span className="capitalize">{c.priority.toLowerCase()}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. CENTER PANEL: Video Player + Timeline + Controls */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col bg-[#0d1117] min-w-0">
        {/* Top Header: Version Selection */}
        <div className="h-12 px-6 border-b border-[#21262d] flex items-center justify-between shrink-0 select-none bg-[#161b22]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-400">Phiên bản:</span>
            <select
              value={selectedVersion?.id || ''}
              onChange={(e) => {
                const found = versions.find((v) => v.id === e.target.value)
                if (found) setSelectedVersion(found)
              }}
              className="h-8 px-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.width}x{v.height})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Video Canvas Area */}
        <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden bg-black/60">
          {selectedVersion && (
            <video
              ref={videoRef}
              src={`file:///${selectedVersion.videoPath.replace(/\\/g, '/')}`}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onClick={togglePlay}
              className="max-h-full max-w-full rounded-lg shadow-2xl object-contain cursor-pointer"
            />
          )}
        </div>

        {/* Timeline Scrub Bar with Feedback Pins */}
        <div className="px-6 py-2 bg-[#161b22] border-t border-[#21262d] select-none">
          <div className="relative w-full h-8 flex items-center">
            {/* Timeline Slider Track */}
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.01"
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#30363d] rounded-lg appearance-none cursor-pointer accent-blue-500"
            />

            {/* Comment Markers on Timeline */}
            {duration > 0 &&
              comments.map((c) => {
                const pct = (c.timestamp / duration) * 100
                const isFixed = c.status === 'FIXED'
                return (
                  <button
                    key={c.id}
                    title={`${formatTime(c.timestamp)}: ${c.content}`}
                    onClick={() => {
                      setActiveComment(c)
                      handleSeek(c.timestamp)
                    }}
                    style={{ left: `${pct}%` }}
                    className={`absolute -top-1 -translate-x-1/2 w-2.5 h-4 rounded-sm transition-transform hover:scale-125 z-10 ${
                      isFixed ? 'bg-emerald-500' : 'bg-red-500 shadow-sm shadow-red-500/50'
                    }`}
                  />
                )
              })}
          </div>
        </div>

        {/* Player Controls Toolbar */}
        <div className="h-14 px-6 bg-[#161b22] border-t border-[#21262d] flex items-center justify-between shrink-0 select-none">
          {/* Left: Frame Step Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => stepFrame(-1)}
              title="Lùi 1 frame (←)"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlay}
              title="Phát / Tạm dừng (Space)"
              className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg transition"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={() => stepFrame(1)}
              title="Tiến 1 frame (→)"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Center: Action trigger */}
          <button
            onClick={handleStartComment}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white text-xs font-semibold rounded-lg border border-blue-500/30 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm nhận xét tại timestamp này (C)</span>
          </button>

          {/* Right: Short Instructions */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <span>[Space] Pause</span>
            <span>•</span>
            <span>[← / →] Frame</span>
            <span>•</span>
            <span>[C] Comment</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. RIGHT PANEL: Review Form & Annotation Workspace (400px) */}
      {/* ============================================================ */}
      <div className="w-96 bg-[#161b22] border-l border-[#21262d] flex flex-col shrink-0 select-none overflow-y-auto">
        {isCreatingComment ? (
          /* --- State A: Creating New Comment + Drawing --- */
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#21262d]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Thêm phản hồi</h3>
              </div>
              <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                {formatTime(currentTime)}
              </span>
            </div>

            {/* Captured Frame & Annotation Canvas */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-400">Khung hình chú thích</p>
              <AnnotationCanvas
                ref={annotationCanvasRef}
                imageSrc={capturedFrameBase64}
                annotations={inProgressAnnotations}
                onAnnotationsChange={setInProgressAnnotations}
                currentTool={currentTool}
                currentColor={currentColor}
                strokeWidth={strokeWidth}
              />
              <DrawingToolbar
                currentTool={currentTool}
                setCurrentTool={setCurrentTool}
                currentColor={currentColor}
                setCurrentColor={setCurrentColor}
                strokeWidth={strokeWidth}
                setStrokeWidth={setStrokeWidth}
                onUndo={() => setInProgressAnnotations(inProgressAnnotations.slice(0, -1))}
                onClear={() => setInProgressAnnotations([])}
                canUndo={inProgressAnnotations.length > 0}
              />
            </div>

            {/* Category & Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Danh mục
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as CommentCategory)}
                  className="w-full h-8 px-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="SUBTITLE">Phụ đề</option>
                  <option value="PACING">Nhịp cắt</option>
                  <option value="CUT">Điểm cắt</option>
                  <option value="AUDIO">Âm thanh</option>
                  <option value="COLOR">Màu sắc</option>
                  <option value="EFFECT">Hiệu ứng</option>
                  <option value="GRAPHICS">Đồ họa</option>
                  <option value="GENERAL">Chung</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Mức ưu tiên
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as CommentPriority)}
                  className="w-full h-8 px-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="HIGH">Cao (High)</option>
                  <option value="MEDIUM">Trung bình</option>
                  <option value="LOW">Thấp</option>
                  <option value="CRITICAL">Khẩn cấp</option>
                </select>
              </div>
            </div>

            {/* Comment Text Area */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Nội dung nhận xét <span className="text-red-400">*</span>
              </label>
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="VD: Subtitle che mặt nhân vật. Đưa xuống dưới và lệch trái..."
                rows={3}
                className="w-full p-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingComment(false)}
                className="px-3 h-8 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveComment}
                disabled={!newCommentText.trim()}
                className="px-4 h-8 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
              >
                Lưu phản hồi (Ctrl+Enter)
              </button>
            </div>
          </div>
        ) : activeComment ? (
          /* --- State B: Viewing Selected Comment --- */
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#21262d]">
              <div>
                <h3 className="text-sm font-bold text-white">Chi tiết nhận xét</h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  ID: {activeComment.id} • {new Date(activeComment.createdAt).toLocaleDateString('vi-VN')}
                </p>
              </div>
              <button
                onClick={() => handleDeleteComment(activeComment.id)}
                title="Xóa nhận xét"
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Status & Priority Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Trạng thái
                </label>
                <select
                  value={activeComment.status}
                  onChange={(e) =>
                    handleUpdateStatus(activeComment.id, e.target.value as CommentStatus)
                  }
                  className="w-full h-8 px-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs font-bold text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="OPEN">Đang mở (Open)</option>
                  <option value="FIXED">Đã sửa (Fixed)</option>
                  <option value="PARTIAL">Sửa một phần</option>
                  <option value="REJECTED">Từ chối</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Thời điểm
                </label>
                <div className="h-8 px-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs font-mono font-bold text-blue-400 flex items-center">
                  {formatTime(activeComment.timestamp)}
                </div>
              </div>
            </div>

            {/* Comment Content */}
            <div className="p-3 bg-[#0d1117] border border-[#21262d] rounded-lg space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                {activeComment.category} • {activeComment.priority}
              </span>
              <p className="text-xs text-slate-200 leading-relaxed">
                {activeComment.content}
              </p>
            </div>

            {/* Frame / Annotated Frame Preview */}
            {activeComment.attachments && activeComment.attachments.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-400">
                  Khung hình đã đánh dấu
                </span>
                <div className="space-y-2">
                  {activeComment.attachments.map((att) => {
                    const imgUrl = `file:///${activeProject.projectPath.replace(/\\/g, '/')}/${att.filePath.replace(/\\/g, '/')}`
                    return (
                      <div
                        key={att.id}
                        className="relative aspect-video bg-black rounded-lg overflow-hidden border border-[#30363d]"
                      >
                        <img
                          src={imgUrl}
                          alt={att.type}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono text-white">
                          {att.type === 'ANNOTATED_FRAME' ? 'ANNOTATED' : 'RAW FRAME'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* --- State C: Empty State --- */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-slate-500 space-y-3">
            <Clock className="w-8 h-8 text-slate-600" />
            <p className="font-medium text-slate-300">Không có phản hồi nào được chọn</p>
            <p className="text-[11px] text-slate-500 max-w-xs">
              Chọn một nhận xét trong danh sách bên trái hoặc nhấn nút "Thêm (C)" để tạo phản hồi mới kèm hình vẽ chú thích.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
