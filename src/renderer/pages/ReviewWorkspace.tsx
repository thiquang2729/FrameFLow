import React, { useEffect, useRef, useState } from 'react'
import { Maximize, MessageSquare, Pause, Play, Plus, SkipBack, SkipForward } from 'lucide-react'
import { CommentCategory, CommentPriority, CommentStatus, EditVersion, Project, ReviewComment } from '@shared/types'
import { useProjectStore } from '../stores/project.store'

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

function fileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return encodeURI(normalized.startsWith('//') ? `file:${normalized}` : `file:///${normalized.replace(/^\//, '')}`)
    .replace(/#/g, '%23').replace(/\?/g, '%3F')
}

export const ReviewWorkspace: React.FC = () => {
  const project = useProjectStore((state) => state.activeProject)
  if (!project) return <div className="flex-1 p-8 text-slate-500">Chọn một dự án để bắt đầu duyệt video.</div>
  return <ProjectReview key={project.id} project={project} />
}

function ProjectReview({ project }: { project: Project }): React.ReactElement {
  const setActiveTab = useProjectStore((state) => state.setActiveTab)
  const [versions, setVersions] = useState<EditVersion[]>([])
  const [versionId, setVersionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    window.api.listVersions(project.id).then((list: EditVersion[]) => {
      if (cancelled) return
      setVersions(list)
      setVersionId(list[list.length - 1]?.id || '')
    }).catch(() => { if (!cancelled) setError('Không thể tải phiên bản. Hãy mở lại màn hình Review.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [project.id])

  const version = versions.find((item) => item.id === versionId)
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8fafc] text-slate-800">
      <header className="flex items-center justify-between gap-4 p-4 border-b border-slate-200 bg-white">
        <div><h1 className="font-bold text-lg">{project.name}</h1><p className="text-xs text-slate-500">Duyệt bản dựng · Phản hồi được lưu riêng theo phiên bản</p></div>
        <div className="flex items-center gap-2">
          <select aria-label="Phiên bản đang duyệt" className={inputClass} value={versionId} onChange={(event) => setVersionId(event.target.value)} disabled={!versions.length}>
            {!versions.length && <option value="">Chưa có bản dựng</option>}
            {versions.map((item) => <option key={item.id} value={item.id}>V{item.versionNumber} — {item.name}</option>)}
          </select>
          <button className={`${buttonClass} whitespace-nowrap`} onClick={() => setActiveTab('versions')}>Nhập bản dựng</button>
          <button className={`${buttonClass} whitespace-nowrap`} onClick={() => setActiveTab('export')}>Xuất phản hồi</button>
        </div>
      </header>
      {loading ? <p role="status" className="p-8">Đang tải phiên bản...</p>
        : error ? <p role="alert" className="p-8 text-red-600">{error}</p>
        : version ? <VersionReview key={version.id} project={project} version={version} />
        : <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500"><MessageSquare /><p>Nhập video trong mục Phiên bản để bắt đầu review.</p><button className={buttonClass} onClick={() => setActiveTab('versions')}>Đến Phiên bản</button></div>}
    </div>
  )
}

function VersionReview({ project, version }: { project: Project; version: EditVersion }): React.ReactElement {
  const refreshStats = useProjectStore((state) => state.refreshStats)
  const videoRef = useRef<HTMLVideoElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const mounted = useRef(true)
  const busy = useRef(false)
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
  const [draftTime, setDraftTime] = useState<number | null>(null)
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<CommentCategory>('GENERAL')
  const [priority, setPriority] = useState<CommentPriority>('MEDIUM')
  const [saving, setSaving] = useState(false)
  const selected = comments.find((item) => item.id === selectedId)
  const visibleComments = comments.filter((item) => filter === 'ALL' || item.status === filter)

  useEffect(() => {
    mounted.current = true
    window.api.listComments(project.id, version.id).then((list: ReviewComment[]) => {
      if (mounted.current) setComments(list)
    }).catch(() => { if (mounted.current) setError('Không thể tải bình luận. Hãy mở lại phiên bản.') })
      .finally(() => { if (mounted.current) setLoading(false) })
    return () => { mounted.current = false }
  }, [project.id, version.id])

  const seek = (target: number) => {
    const video = videoRef.current
    if (!video || !ready || draftTime !== null) return
    video.pause()
    video.currentTime = Math.max(0, Math.min(duration, target))
    setTime(video.currentTime)
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video || !ready || draftTime !== null) return
    if (video.paused) void video.play().catch(() => setMediaError('Không phát được video. Kiểm tra tệp hoặc dùng MP4 H.264.'))
    else video.pause()
  }

  const startComment = () => {
    const video = videoRef.current
    if (!video || !ready || video.seeking || draftTime !== null || busy.current || loading) return
    video.pause()
    setDraftTime(video.currentTime)
    setContent('')
    setSelectedId(null)
    setError('')
  }

  const saveComment = async () => {
    if (draftTime === null || !content.trim() || busy.current) return
    busy.current = true
    setSaving(true)
    setError('')
    try {
      const comment: ReviewComment = await window.api.createComment({
        projectId: project.id, editVersionId: version.id, timestamp: draftTime,
        frameNumber: Math.round(draftTime * (version.fps || 30)), category, priority, content: content.trim()
      })
      if (!mounted.current) return
      setComments((list) => [...list, comment].sort((a, b) => a.timestamp - b.timestamp))
      setSelectedId(comment.id)
      setFilter('ALL')
      setDraftTime(null)
      setContent('')
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

  useEffect(() => { if (draftTime !== null) textRef.current?.focus() }, [draftTime])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      const target = event.target as HTMLElement | null
      const editing = target?.closest('input, textarea, select, button, [contenteditable="true"]')
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && draftTime !== null) {
        event.preventDefault()
        void saveComment()
        return
      }
      if (editing || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === 'Escape' && !saving) { setDraftTime(null); return }
      if (draftTime !== null) {
        const choice: Record<string, CommentPriority> = { '1': 'LOW', '2': 'MEDIUM', '3': 'HIGH' }
        if (choice[event.key]) setPriority(choice[event.key])
        return
      }
      if (event.code === 'Space') { event.preventDefault(); togglePlay() }
      else if (event.key.toLowerCase() === 'c') { event.preventDefault(); startComment() }
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
    if (draftTime !== null || saving) return
    setSelectedId(comment.id)
    seek(comment.timestamp)
  }

  return (
    <>
      {error && <p role="alert" className="p-3 text-xs text-red-700 bg-red-50">{error}</p>}
      <div className="flex-1 flex min-h-0 overflow-x-auto">
        <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col">
          <div className="p-4 border-b space-y-3"><h2 className="text-sm font-bold">Bình luận ({comments.length})</h2>
            <select aria-label="Lọc trạng thái bình luận" className={inputClass} value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="ALL">Tất cả trạng thái</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? <p role="status" className="text-xs text-slate-500">Đang tải bình luận...</p> : !visibleComments.length && <p className="text-xs text-slate-500">Chưa có bình luận{filter === 'ALL' ? '. Nhấn C để thêm.' : ' phù hợp bộ lọc.'}</p>}
            {visibleComments.map((comment) => <button key={comment.id} disabled={draftTime !== null || saving} onClick={() => pickComment(comment)} className={`w-full text-left p-3 rounded-xl border space-y-2 disabled:opacity-50 ${selectedId === comment.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <div className="flex justify-between text-xs"><span className="font-mono text-blue-600">{formatTime(comment.timestamp)}</span><span>{comment.id}</span></div>
              <p className="text-xs break-words whitespace-pre-wrap">{comment.content}</p>
              <p className="text-[11px] text-slate-500">{categories[comment.category]} · {priorities[comment.priority]} · {statuses[comment.status]}</p>
            </button>)}
          </div>
        </aside>
        <main className="flex-1 min-w-[320px] flex flex-col">
          <div className="flex-1 min-h-0 bg-slate-100 p-4 flex items-center justify-center relative">
            <video key={version.id} ref={videoRef} src={fileUrl(version.videoPath)} preload="metadata" className="w-full h-full object-contain bg-black rounded-xl" onClick={togglePlay}
              onLoadedMetadata={(event) => { const value = event.currentTarget.duration; setDuration(Number.isFinite(value) ? value : 0) }}
              onLoadedData={() => { setReady(true); setMediaError('') }}
              onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
              onSeeked={(event) => setTime(event.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
              onError={() => { setReady(false); setPlaying(false); setMediaError('Không mở được video. Tệp có thể đã bị di chuyển hoặc codec không được hỗ trợ. Hãy thử MP4 H.264.') }} />
            {mediaError && <p role="alert" className="absolute inset-x-8 p-4 rounded-xl bg-white text-red-700 text-xs">{mediaError}</p>}
          </div>
          <div className="bg-white border-t p-4 space-y-4">
            <div className="flex justify-between gap-2 items-center text-xs">
              <span className="font-mono">{formatTime(time)} / {formatTime(duration)}</span>
              <div className="flex gap-2">
                <button aria-label="Frame trước" className={buttonClass} disabled={!ready || draftTime !== null} onClick={() => seek(time - 1 / (version.fps || 30))}><SkipBack size={14} /></button>
                <button aria-label={playing ? 'Tạm dừng' : 'Phát'} className={buttonClass} disabled={!ready || draftTime !== null} onClick={togglePlay}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
                <button aria-label="Frame tiếp" className={buttonClass} disabled={!ready || draftTime !== null} onClick={() => seek(time + 1 / (version.fps || 30))}><SkipForward size={14} /></button>
              </div>
              <button aria-label="Toàn màn hình" className={buttonClass} onClick={() => { void videoRef.current?.requestFullscreen().catch(() => setError('Không thể bật toàn màn hình.')) }}><Maximize size={14} /></button>
            </div>
            <label className="flex items-center gap-2 text-xs">Âm lượng <input aria-label="Âm lượng" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => { const value = Number(event.target.value); setVolume(value); if (videoRef.current) videoRef.current.volume = value }} /></label>
            <input aria-label="Vị trí phát video" type="range" min="0" max={duration || 1} step="0.001" value={Math.min(time, duration)} disabled={!ready || draftTime !== null} onChange={(event) => seek(Number(event.target.value))} className="w-full" />
            <div className="relative h-7 mx-2 bg-slate-50 rounded-lg" aria-label="Marker bình luận">
              {duration > 0 && comments.map((comment) => <button key={comment.id} aria-label={`${formatTime(comment.timestamp)}: ${comment.content}`} title={`${formatTime(comment.timestamp)}: ${comment.content}`} disabled={draftTime !== null || saving} onClick={() => pickComment(comment)} style={{ left: `${Math.min(100, comment.timestamp / duration * 100)}%` }} className={`absolute top-1 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-white ${comment.status === 'FIXED' ? 'bg-emerald-500' : 'bg-blue-500'}`} />)}
            </div>
            <p className="text-[10px] text-slate-400">Space: phát/dừng · C: bình luận · ←/→: frame · Shift+←/→: 5 giây · Frame ước tính ({version.fps || 30} fps)</p>
          </div>
        </main>
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4 space-y-4">
          <h2 className="font-bold text-sm">Ghi chú duyệt</h2>
          {draftTime !== null ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveComment() }}>
            <p className="font-mono text-xs">{formatTime(draftTime)} · Frame ~{Math.round(draftTime * (version.fps || 30))}</p>
            <label className="block text-xs space-y-1"><span>Danh mục</span><select className={inputClass} value={category} disabled={saving} onChange={(event) => setCategory(event.target.value as CommentCategory)}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block text-xs space-y-1"><span>Mức ưu tiên</span><select className={inputClass} value={priority} disabled={saving} onChange={(event) => setPriority(event.target.value as CommentPriority)}>{Object.entries(priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block text-xs space-y-1"><span>Nội dung phản hồi</span><textarea ref={textRef} className={inputClass} rows={7} required value={content} disabled={saving} onChange={(event) => setContent(event.target.value)} /></label>
            <div className="flex gap-2"><button type="button" className={buttonClass} disabled={saving} onClick={() => setDraftTime(null)}>Hủy</button><button type="submit" disabled={saving || !content.trim()} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>{saving ? 'Đang lưu...' : 'Lưu bình luận'}</button></div>
            <p className="text-[10px] text-slate-400">Ctrl+Enter: lưu · Mốc thời gian được giữ cố định trong khi nhập.</p>
          </form> : <>
            <button className={`${buttonClass} flex items-center gap-2`} disabled={!ready || loading || saving} onClick={startComment}><Plus size={14} />Thêm bình luận (C)</button>
            {selected ? <div className="space-y-4 text-xs">
              <p className="font-mono text-blue-600">{selected.id} · {formatTime(selected.timestamp)}</p>
              <p>{categories[selected.category]} · Ưu tiên: {priorities[selected.priority]}</p>
              <p className="whitespace-pre-wrap break-words leading-relaxed">{selected.content}</p>
              <label className="block space-y-1"><span>Trạng thái</span><select className={inputClass} disabled={saving} value={selected.status} onChange={(event) => { void updateStatus(event.target.value as CommentStatus) }}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <p className="text-slate-400">{new Date(selected.createdAt).toLocaleString('vi-VN')}</p>
            </div> : <p className="text-xs text-slate-500">Chọn bình luận để xem chi tiết hoặc tạm dừng video để ghi nhận phản hồi.</p>}
          </>}
        </aside>
      </div>
    </>
  )
}
