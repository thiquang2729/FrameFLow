import React, { useEffect, useState } from 'react'
import { FileText, Sparkles } from 'lucide-react'
import { EditVersion, Project, ProjectStats, ReviewComment } from '@shared/types'
import { useProjectStore } from '../stores/project.store'
import { localFileUrl } from '../lib/source-media'
import { ProjectScriptModal } from '../components/project/ProjectScriptModal'

const buttonClass = 'px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium hover:bg-slate-50 disabled:opacity-40'
const statusLabels: Record<string, string> = { PLANNING: 'Lên kế hoạch', INGESTING: 'Nhập tư liệu', EDITING: 'Đang dựng', REVIEW: 'Đang duyệt', REVIEWING: 'Đang duyệt', FINAL: 'Hoàn tất' }
const reviewStatuses = { OPEN: 'Đang mở', IN_PROGRESS: 'Đang xử lý', FIXED: 'Đã sửa', PARTIAL: 'Sửa một phần', REJECTED: 'Từ chối' }

export const Dashboard: React.FC = () => {
  const project = useProjectStore((state) => state.activeProject)
  if (!project) return <div className="flex-1 p-8 text-slate-500">Chưa chọn dự án. Tạo dự án mới hoặc chọn dự án từ sidebar.</div>
  return <ProjectDashboard key={project.id} project={project} />
}

function ProjectDashboard({ project }: { project: Project }): React.ReactElement {
  const { setActiveTab, openReview, selectVersion } = useProjectStore()
  const [stats, setStats] = useState<ProjectStats | null>(null)
  const [latest, setLatest] = useState<EditVersion | null>(null)
  const [recent, setRecent] = useState<ReviewComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mediaError, setMediaError] = useState('')
  const [reload, setReload] = useState(0)
  const [scriptModalOpen, setScriptModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setMediaError('')
    const load = async () => {
      const [counts, versions] = await Promise.all([window.api.getProjectStats(project.id), window.api.listVersions(project.id)])
      const current: EditVersion | null = versions[versions.length - 1] || null
      const comments: ReviewComment[] = current ? await window.api.listComments(project.id, current.id) : []
      if (cancelled) return
      setStats(counts)
      setLatest(current)
      setRecent(comments.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4))
    }
    void load().catch(() => { if (!cancelled) setError('Không tải được tổng quan. Vui lòng thử lại.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [project.id, reload])

  return (
    <div className="flex-1 p-6 overflow-y-auto min-w-0 space-y-5 bg-[#f8fafc] text-slate-800">
      <header className="flex flex-wrap justify-between gap-3"><div><h1 className="font-bold text-2xl">{project.name}</h1><p className="text-xs text-slate-500 mt-1">{project.targetPlatform || 'Chưa có nền tảng'} · {project.aspectRatio || 'Chưa có tỉ lệ'} · Mục tiêu: {project.targetDuration ?? 'chưa nhập'} giây</p></div><button className={buttonClass} disabled={loading} onClick={() => setReload((value) => value + 1)}>Làm mới tổng quan</button></header>
      {loading ? <p role="status" className="text-xs text-slate-500">Đang tải tổng quan...</p> : error ? <p role="alert" className="text-xs text-red-700">{error}</p> : <>
        <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            ['Tư liệu SRC', stats?.sourceCount ?? 0], ['Phiên bản dựng', stats?.versionCount ?? 0],
            ['Phản hồi chưa xong', stats?.openReviewCount ?? 0], ['Ưu tiên cao/khẩn cấp chưa xong', stats?.highPriorityCount ?? 0]
          ].map(([label, count]) => <div key={label} className="p-4 bg-white border rounded-2xl"><h2 className="text-xs text-slate-500">{label}</h2><p aria-label={String(label)} className="font-bold text-2xl mt-2">{count}</p></div>)}
        </section>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <section className="p-4 bg-white border rounded-2xl space-y-4">
            <h2 className="text-sm font-bold">Bản dựng hiện tại</h2>
            {latest ? <>
              <video key={latest.id} src={localFileUrl(latest.videoPath)} controls preload="metadata" className={`w-full object-contain bg-black rounded-xl ${latest.width && latest.height && latest.height > latest.width ? 'max-h-[340px] aspect-[9/16] mx-auto block' : 'aspect-video'}`} onError={() => setMediaError('Không phát được bản dựng. Kiểm tra vị trí tệp hoặc codec.')} />
              {mediaError && <p role="alert" className="text-xs text-red-700">{mediaError}</p>}
              <div><h3 className="font-semibold text-sm">V{latest.versionNumber} — {latest.name}{latest.width && latest.height && latest.height > latest.width && <span className="ml-2 px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold text-[10px]">9:16 Dọc</span>}</h3><p className="text-xs text-slate-500 mt-1">{latest.duration ? `${latest.duration.toFixed(2)}s` : 'Chưa rõ thời lượng'} · {latest.width && latest.height ? `${latest.width}×${latest.height}` : 'Chưa rõ độ phân giải'}</p></div>
              <div className="flex flex-wrap gap-2"><button className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`} onClick={() => openReview(latest.id)}>Duyệt bản dựng hiện tại</button><button className={buttonClass} onClick={() => { selectVersion(latest.id); setActiveTab('export') }}>Xuất gói phản hồi</button></div>
            </> : <div className="p-6 border border-dashed rounded-xl space-y-3 text-center text-slate-500"><p className="text-sm">Chưa có bản dựng.</p><button className={buttonClass} onClick={() => setActiveTab('versions')}>Nhập bản dựng đầu tiên</button></div>}
            <button className={`${buttonClass} w-full`} onClick={() => setActiveTab('versions')}>Xem tất cả phiên bản</button>
          </section>
          <section className="p-4 bg-white border rounded-2xl space-y-3"><h2 className="text-sm font-bold">Phản hồi gần đây{latest ? ` · ${latest.name}` : ''}</h2>
            {!recent.length ? <p className="text-xs text-slate-500">Chưa có phản hồi cho bản dựng hiện tại.</p> : recent.map((comment) => <button key={comment.id} aria-label={`Mở phản hồi ${comment.id}`} className="w-full text-left p-3 bg-slate-50 border rounded-xl space-y-2 hover:bg-blue-50" onClick={() => openReview(comment.editVersionId, comment.id)}><p className="text-xs font-semibold">{comment.id} · {comment.timestamp.toFixed(3)}s · {reviewStatuses[comment.status]}</p><p className="text-xs whitespace-pre-wrap break-words">{comment.content}</p><p className="text-[11px] text-slate-400">{new Date(comment.createdAt).toLocaleString('vi-VN')}</p></button>)}
          </section>
        </div>
      </>}
      <section className="p-5 bg-white border rounded-2xl space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <FileText size={16} className="text-blue-600" />
              <span>Kịch bản & Mục tiêu dự án</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Kịch bản được dùng để AI chấm điểm độ phù hợp (Editorial score) của các clip nguồn trong thư viện SRC.
            </p>
          </div>
          <button
            type="button"
            className={`${buttonClass} flex items-center gap-1.5 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors font-semibold`}
            onClick={() => setScriptModalOpen(true)}
          >
            <Sparkles size={14} className="text-amber-500" />
            <span>Xem / Sửa kịch bản & Brief</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <h3 className="font-semibold text-slate-700">Mục tiêu & Định hướng</h3>
            <p className="whitespace-pre-wrap break-words text-slate-600 leading-relaxed">
              {project.description || 'Chưa có mô tả định hướng.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-2 text-[11px] text-slate-500">
              <span className="px-2 py-0.5 bg-white rounded border border-slate-200 font-medium">Nền tảng: {project.targetPlatform || 'Chưa đặt'}</span>
              <span className="px-2 py-0.5 bg-white rounded border border-slate-200 font-medium">Tỉ lệ: {project.aspectRatio || '16:9'}</span>
              <span className="px-2 py-0.5 bg-white rounded border border-slate-200 font-medium">Thời lượng: {project.targetDuration ? `${project.targetDuration}s` : 'Chưa đặt'}</span>
            </div>
          </div>

          <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <h3 className="font-semibold text-slate-700 flex items-center gap-1.5">
              <span>Kịch bản phân cảnh</span>
              {project.script ? (
                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 text-[10px] font-semibold">Đã có</span>
              ) : (
                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold">Chưa có</span>
              )}
            </h3>
            {project.script ? (
              <pre className="whitespace-pre-wrap break-words text-slate-700 font-mono text-[11px] max-h-36 overflow-y-auto leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200/60">
                {project.script}
              </pre>
            ) : (
              <div className="text-slate-400 p-3 bg-white rounded-lg border border-dashed border-slate-200 text-center space-y-1">
                <p>Chưa nhập kịch bản phân cảnh chi tiết.</p>
                <button
                  type="button"
                  onClick={() => setScriptModalOpen(true)}
                  className="text-blue-600 font-medium hover:underline text-[11px]"
                >
                  + Nhập kịch bản để AI đối chiếu footage
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pt-2 text-[11px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100">
          <span>Trạng thái: <strong>{statusLabels[project.status] || project.status}</strong></span>
          <span>Tạo: {new Date(project.createdAt).toLocaleDateString('vi-VN')}</span>
          <span>Cập nhật: {new Date(project.updatedAt).toLocaleDateString('vi-VN')}</span>
          <span className="break-all">Lưu: {project.projectPath}</span>
        </div>
      </section>

      <ProjectScriptModal
        isOpen={scriptModalOpen}
        onClose={() => setScriptModalOpen(false)}
        project={project}
      />
    </div>
  )
}
