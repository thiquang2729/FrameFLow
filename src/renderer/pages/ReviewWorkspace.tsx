import React, { useEffect, useRef, useState } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Plus,
  MessageSquare,
  Volume2,
  Maximize,
  ChevronDown,
  Upload,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Clock,
  ArrowUp,
  Trash2,
  Check,
  Smile,
  Send,
  Layers
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

interface MockReviewItem {
  id: string
  timestamp: string
  secs: number
  title: string
  desc: string
  author: string
  avatar: string
  avatarBg: string
  replies: number
  category: string
  priority: string
  status: string
  thumbnail: string
  annotatedImage: string
}

const sampleReviews: MockReviewItem[] = [
  {
    id: '1',
    timestamp: '00:05.120',
    secs: 5.12,
    title: 'Phần mở đầu chưa đủ cuốn hút',
    desc: 'Phần mở đầu đang thiếu sức hút, cần tạo sự chú ý mạnh hơn ngay từ những giây đầu tiên...',
    author: 'Maya Chen',
    avatar: 'MK',
    avatarBg: 'bg-[#c29d72]',
    replies: 2,
    category: 'Nhịp cắt',
    priority: 'Cao',
    status: 'Đang mở',
    thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    annotatedImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: '2',
    timestamp: '00:17.420',
    secs: 17.42,
    title: 'Phụ đề che mặt',
    desc: 'Phụ đề đang che mất khuôn mặt của nhân vật. Hãy di chuyển phụ đề xuống thấp hơn và giảm nhẹ độ mờ.',
    author: 'Maya Chen',
    avatar: 'MK',
    avatarBg: 'bg-[#c29d72]',
    replies: 3,
    category: 'Phụ đề',
    priority: 'Cao',
    status: 'Đang mở',
    thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    annotatedImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: '3',
    timestamp: '00:28.310',
    secs: 28.31,
    title: 'Nhịp cắt hơi chậm',
    desc: 'Nhịp cắt của cảnh này hơi chậm. Hãy rút ngắn lại một chút để tăng sự liền mạch...',
    author: 'Jordan Dell',
    avatar: 'JD',
    avatarBg: 'bg-blue-600',
    replies: 1,
    category: 'Nhịp cắt',
    priority: 'Trung bình',
    status: 'Đang mở',
    thumbnail: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=200&q=80',
    annotatedImage: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: '4',
    timestamp: '00:35.100',
    secs: 35.1,
    title: 'Cảnh quay quá tối',
    desc: 'Cảnh này thiếu sáng, khó thấy chi tiết trong khung hình. Có thể tăng độ phơi sáng...',
    author: 'Alex Lee',
    avatar: 'AL',
    avatarBg: 'bg-slate-500',
    replies: 2,
    category: 'Màu sắc',
    priority: 'Cao',
    status: 'Đã sửa',
    thumbnail: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
    annotatedImage: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: '5',
    timestamp: '00:41.800',
    secs: 41.8,
    title: 'Hiệu ứng logo đoạn kết',
    desc: 'Hiệu ứng logo ở đoạn kết cần mượt hơn và giữ lâu hơn một chút để tăng khả năng nhận diện thương hiệu.',
    author: 'Maya Chen',
    avatar: 'MK',
    avatarBg: 'bg-[#c29d72]',
    replies: 1,
    category: 'Đồ họa',
    priority: 'Thấp',
    status: 'Đã sửa',
    thumbnail: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=200&q=80',
    annotatedImage: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=600&q=80'
  }
]

export const ReviewWorkspace: React.FC = () => {
  const { activeProject, refreshStats, setActiveTab } = useProjectStore()

  // Versions
  const [versions, setVersions] = useState<EditVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<EditVersion | null>(null)

  // Comments
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [selectedMockIndex, setSelectedMockIndex] = useState(1) // Item 2 default (00:17.420)
  const [activeComment, setActiveComment] = useState<ReviewComment | null>(null)

  // Video Player state
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(17.42)
  const [duration, setDuration] = useState(48.03)

  // Annotation state
  const [isCreatingComment, setIsCreatingComment] = useState(false)
  const [newCommentText, setNewCommentText] = useState('')
  const [newCategory, setNewCategory] = useState<CommentCategory>('SUBTITLE')
  const [newPriority, setNewPriority] = useState<CommentPriority>('HIGH')
  const [capturedFrameBase64, setCapturedFrameBase64] = useState<string | null>(null)
  const [inProgressAnnotations, setInProgressAnnotations] = useState<Annotation[]>([])

  // Drawing Tools
  const [currentTool, setCurrentTool] = useState<AnnotationType>('ARROW')
  const [currentColor, setCurrentColor] = useState<string>('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState<number>(4)
  const annotationCanvasRef = useRef<{ getAnnotatedBase64: () => string | null }>(null)

  const loadVersions = async () => {
    if (!activeProject) return
    const list = await window.api.listVersions(activeProject.id)
    setVersions(list)
    if (list.length > 0 && !selectedVersion) {
      setSelectedVersion(list[list.length - 1])
    }
  }

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
    }
  }, [selectedVersion])

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play()
        setIsPlaying(true)
      } else {
        videoRef.current.pause()
        setIsPlaying(false)
      }
    } else {
      setIsPlaying(!isPlaying)
    }
  }

  const stepFrame = (frames: number) => {
    if (videoRef.current) {
      videoRef.current.pause()
      setIsPlaying(false)
      const fps = selectedVersion?.fps || 30
      videoRef.current.currentTime = Math.max(
        0,
        Math.min(duration, videoRef.current.currentTime + frames / fps)
      )
      setCurrentTime(videoRef.current.currentTime)
    } else {
      setCurrentTime((prev) => Math.max(0, Math.min(duration, prev + frames * 0.033)))
    }
  }

  const handleSeek = (time: number) => {
    setCurrentTime(time)
    if (videoRef.current) {
      videoRef.current.currentTime = time
    }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    const ms = Math.floor((secs % 1) * 1000)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const currentMock = sampleReviews[selectedMockIndex] || sampleReviews[0]

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc] text-slate-800">
      {/* 1. Top Header Row */}
      <div className="h-16 px-8 border-b border-slate-200/90 flex items-center justify-between shrink-0 bg-white">
        <div className="space-y-0.5">
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {activeProject ? activeProject.name : 'UTH Video Quảng Bá'}
          </h1>
          <div className="flex items-center gap-2.5 text-xs text-slate-500 font-medium">
            <span>{activeProject?.targetPlatform || 'Thương hiệu'}</span>
            <span>•</span>
            <span>00:45–01:00</span>
            <span>•</span>
            <span>{activeProject?.aspectRatio || '16:9'}</span>
            <span>•</span>
            <span>v3 (Bản nháp)</span>
            <span>•</span>
            <span>Cập nhật 2 giờ trước</span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          {/* Avatar stack */}
          <div className="flex items-center -space-x-1.5">
            <div className="w-7 h-7 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-2xs">
              JD
            </div>
            <div className="w-7 h-7 rounded-full bg-[#f59e0b] border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-2xs">
              MK
            </div>
            <div className="w-7 h-7 rounded-full bg-slate-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-2xs">
              AL
            </div>
            <div className="w-7 h-7 rounded-full bg-white border border-slate-300 flex items-center justify-center text-xs text-slate-600 shadow-2xs cursor-pointer hover:bg-slate-50 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </div>
          </div>

          <button
            type="button"
            className="flex items-center gap-2 px-3.5 h-9 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Chia sẻ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className="flex items-center gap-2 px-4 h-9 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Xuất phản hồi</span>
          </button>
        </div>
      </div>

      {/* 2. Main 3-Column Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* ======================================================== */}
        {/* COLUMN 1 (LEFT): Comments List (~290px)                 */}
        {/* ======================================================== */}
        <div className="w-76 border-r border-slate-200/90 bg-white flex flex-col shrink-0 select-none">
          {/* Filter Bar */}
          <div className="p-3.5 border-b border-slate-200/80 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Bình luận (5)</h2>
            <button
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <span>Tất cả bình luận</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </div>

          {/* Comment list items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {sampleReviews.map((item, idx) => {
              const isSelected = selectedMockIndex === idx
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedMockIndex(idx)
                    handleSeek(item.secs)
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/20 shadow-sm'
                      : 'border-slate-200/80 bg-white hover:bg-slate-50/80 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    <div className="relative w-14 h-11 bg-slate-200 rounded-lg overflow-hidden shrink-0 border border-slate-300">
                      <img
                        src={item.thumbnail}
                        alt="thumb"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-semibold text-slate-500">
                          {item.timestamp}
                        </span>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-4 h-4 rounded-full ${item.avatarBg} text-white flex items-center justify-center text-[8px] font-bold`}
                      >
                        {item.avatar}
                      </div>
                      <span className="font-medium text-slate-600">{item.author}</span>
                    </div>
                    <span>{item.replies} phản hồi</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2 (CENTER): Player & Pro Timeline                 */}
        {/* ======================================================== */}
        <div className="flex-1 flex flex-col bg-[#f8fafc] min-w-0 border-r border-slate-200/90">
          {/* Top Video Preview Container */}
          <div className="flex-1 relative flex items-center justify-center p-6 min-h-0 bg-slate-100/50">
            <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-md border border-slate-300/80 group">
              {selectedVersion ? (
                <video
                  ref={videoRef}
                  src={`file:///${selectedVersion.videoPath.replace(/\\/g, '/')}`}
                  className="w-full h-full object-contain"
                  controls={false}
                  onClick={togglePlay}
                />
              ) : (
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80"
                  alt="Video Preview"
                  className="w-full h-full object-cover"
                />
              )}

              {/* In-Frame Subtitle Overlay (Matching mockup "Vì một tương lai tươi sáng cùng nhau") */}
              <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none">
                <span className="px-4 py-1.5 bg-black/75 backdrop-blur-xs text-white text-xs font-medium rounded-lg shadow-lg tracking-wide border border-white/10">
                  Vì một tương lai tươi sáng cùng nhau
                </span>
              </div>
            </div>
          </div>

          {/* Player Controls Bar */}
          <div className="h-12 px-6 bg-white border-t border-slate-200/90 flex items-center justify-between shrink-0 select-none">
            {/* Time Stamp */}
            <span className="font-mono text-xs font-semibold text-slate-700">
              {formatTime(currentTime)} / 00:48:030
            </span>

            {/* Playback Controls */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => stepFrame(-1)}
                className="p-1.5 text-slate-500 hover:text-slate-800 transition-colors"
                title="Frame trước"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shadow-sm transition-all"
                title="Phát / Tạm dừng"
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => stepFrame(1)}
                className="p-1.5 text-slate-500 hover:text-slate-800 transition-colors"
                title="Frame tiếp"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
            </div>

            {/* Right toolbar controls */}
            <div className="flex items-center gap-3.5 text-slate-600">
              <Volume2 className="w-4 h-4 cursor-pointer hover:text-slate-900 transition-colors" />

              <div className="flex items-center gap-1 text-xs cursor-pointer hover:text-slate-900">
                <span>Phù hợp</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>

              <Maximize className="w-4 h-4 cursor-pointer hover:text-slate-900 transition-colors" />
            </div>
          </div>

          {/* Professional Multi-Track Timeline */}
          <div className="h-44 bg-white border-t border-slate-200 flex flex-col shrink-0 select-none">
            {/* Timeline Ruler */}
            <div className="h-7 px-28 border-b border-slate-200 flex items-center justify-between text-[11px] font-mono text-slate-400 relative">
              <span>00:00</span>
              <span>00:10</span>
              {/* Playhead marker indicator on ruler */}
              <div
                className="absolute -top-1 px-1.5 py-0.5 bg-blue-600 text-white rounded text-[10px] font-mono font-bold shadow-xs -translate-x-1/2 flex flex-col items-center z-20"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              >
                <span>{formatTime(currentTime).slice(0, 8)}</span>
                <span className="w-0.5 h-2 bg-blue-600 inline-block" />
              </div>
              <span>00:30</span>
              <span>00:40</span>
            </div>

            {/* Tracks Container */}
            <div className="flex-1 p-3 space-y-2 relative overflow-hidden">
              {/* Vertical Playhead Line across all tracks */}
              <div
                className="absolute top-0 bottom-0 w-[1.5px] bg-blue-600 z-10 pointer-events-none"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />

              {/* Track 1: Filmstrip Thumbnail Track */}
              <div className="flex items-center gap-3">
                <span className="w-20 text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Video</span>
                </span>
                <div className="flex-1 h-9 rounded-lg overflow-hidden bg-purple-100/60 border border-purple-200 flex items-center relative">
                  <div className="absolute inset-y-0 left-0 w-3/4 bg-purple-300/40 border-r-2 border-purple-400 flex items-center px-2">
                    <span className="text-[10px] font-semibold text-purple-700">Clip_01.mp4</span>
                  </div>
                </div>
              </div>

              {/* Track 2: Audio Track */}
              <div className="flex items-center gap-3">
                <span className="w-20 text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <span className="text-teal-600">✦</span>
                  <span>Âm thanh</span>
                </span>
                <div className="flex-1 h-8 rounded-lg overflow-hidden bg-emerald-50 border border-emerald-200/80 flex items-center px-2">
                  <svg className="w-full h-4 text-emerald-500 stroke-current fill-none" viewBox="0 0 300 20">
                    <path
                      d="M 0 10 Q 15 2, 30 10 T 60 10 T 90 3 T 120 17 T 150 10 T 180 5 T 210 15 T 240 10 T 270 2 T 300 10"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>

              {/* Track 3: Comments Pin Track */}
              <div className="flex items-center gap-3">
                <span className="w-20 text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <span>Bình luận</span>
                </span>
                <div className="flex-1 h-6 relative bg-slate-50 border border-slate-200/60 rounded-lg flex items-center px-1">
                  {sampleReviews.map((rev) => {
                    const pct = (rev.secs / duration) * 100
                    return (
                      <button
                        key={rev.id}
                        type="button"
                        onClick={() => handleSeek(rev.secs)}
                        style={{ left: `${pct}%` }}
                        className="absolute -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-blue-500 hover:scale-125 transition-transform border-2 border-white shadow-2xs"
                        title={`${rev.timestamp}: ${rev.title}`}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 3 (RIGHT): Ghi chú duyệt & Drawing (~350px)       */}
        {/* ======================================================== */}
        <aside className="w-88 bg-white border-l border-slate-200/90 flex flex-col shrink-0 select-none overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Ghi chú duyệt</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <button
                  type="button"
                  onClick={() => setSelectedMockIndex(Math.max(0, selectedMockIndex - 1))}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono">
                  {selectedMockIndex + 1} / {sampleReviews.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedMockIndex(Math.min(sampleReviews.length - 1, selectedMockIndex + 1))
                  }
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <button type="button" className="p-1 text-slate-400 hover:text-slate-600">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 text-xs">
            {/* Properties Table */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Mốc thời gian</span>
                </span>
                <span className="font-mono font-bold text-slate-900">{currentMock.timestamp}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Danh mục</span>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-0.5 bg-purple-50 text-purple-700 font-semibold rounded-md border border-purple-200"
                >
                  <span>{currentMock.category}</span>
                  <ChevronDown className="w-3 h-3 text-purple-400" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Mức ưu tiên</span>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 text-red-600 font-bold rounded-md border border-red-200"
                >
                  <ArrowUp className="w-3 h-3 text-red-500" />
                  <span>{currentMock.priority}</span>
                  <ChevronDown className="w-3 h-3 text-red-400" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Trạng thái</span>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 text-red-600 font-bold rounded-md border border-red-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                  <span>{currentMock.status}</span>
                  <ChevronDown className="w-3 h-3 text-red-400" />
                </button>
              </div>
            </div>

            {/* Nhận xét Section */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="font-bold text-slate-900">Nhận xét</span>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className={`w-5 h-5 rounded-full ${currentMock.avatarBg} text-white flex items-center justify-center text-[9px] font-bold`}
                >
                  {currentMock.avatar}
                </div>
                <span className="font-semibold text-slate-800">{currentMock.author}</span>
                <span className="text-slate-400 text-[11px]">• 2 giờ trước</span>
              </div>
              <p className="text-slate-600 leading-relaxed mt-1">{currentMock.desc}</p>
            </div>

            {/* Annotated Frame Display (Matching Mockup with red box & arrow) */}
            <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-300 shadow-2xs group">
              <img
                src={currentMock.annotatedImage}
                alt="Annotated Frame"
                className="w-full h-full object-cover"
              />

              {/* Subtitle box with drawn red border */}
              <div className="absolute bottom-4 inset-x-8 h-8 border-2 border-red-500 bg-black/70 flex items-center justify-center">
                <span className="text-[10px] text-white font-medium">
                  Vì một tương lai tươi sáng cùng nhau
                </span>
              </div>

              {/* Red arrow pointing to subtitle */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <marker
                    id="arrowhead-red"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
                  </marker>
                </defs>
                <line
                  x1="82%"
                  y1="38%"
                  x2="68%"
                  y2="72%"
                  stroke="#ef4444"
                  strokeWidth="3"
                  markerEnd="url(#arrowhead-red)"
                />
              </svg>
            </div>

            {/* Drawing Toolbar Component */}
            <DrawingToolbar
              currentTool={currentTool}
              setCurrentTool={setCurrentTool}
              currentColor={currentColor}
              setCurrentColor={setCurrentColor}
              strokeWidth={strokeWidth}
              setStrokeWidth={setStrokeWidth}
              onUndo={() => {}}
              canUndo={true}
            />

            {/* Bottom Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="px-3.5 h-9 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-2xs"
              >
                Hủy
              </button>

              <button
                type="button"
                className="flex items-center gap-1.5 px-3 h-9 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-2xs"
              >
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span>Thêm bình luận</span>
              </button>

              <button
                type="button"
                className="flex items-center gap-1.5 px-3.5 h-9 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Cập nhật ghi chú</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
