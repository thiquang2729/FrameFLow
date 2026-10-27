import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Folder, Package } from 'lucide-react'
import { useProjectStore } from '../stores/project.store'
import { CreateRevisionPackageDTO, EditVersion, Project, ReviewComment, RevisionPackage, RevisionPackagePreview } from '@shared/types'

const inputClass = 'w-full p-2 border border-slate-200 rounded-xl text-xs bg-white disabled:opacity-50'
const buttonClass = 'px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium hover:bg-slate-50 disabled:opacity-40'
const priorities = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao', CRITICAL: 'Khẩn cấp' }
const statuses = { OPEN: 'Đang mở', IN_PROGRESS: 'Đang xử lý', FIXED: 'Đã sửa', PARTIAL: 'Sửa một phần', REJECTED: 'Từ chối' }
const sizeLabel = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`
const timeLabel = (seconds: number) => {
  const ms = Math.max(0, Math.round(seconds * 1000))
  return `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}

export const ExportPackage: React.FC = () => {
  const project = useProjectStore((state) => state.activeProject)
  if (!project) return <div className="flex-1 p-8 text-slate-500">Chọn một dự án để xuất gói chỉnh sửa.</div>
  return <ProjectExport key={project.id} project={project} />
}

function ProjectExport({ project }: { project: Project }): React.ReactElement {
  const setActiveTab = useProjectStore((state) => state.setActiveTab)
  const initialVersionId = useProjectStore((state) => state.activeVersionId)
  const selectVersion = useProjectStore((state) => state.selectVersion)
  const [versions, setVersions] = useState<EditVersion[]>([])
  const [sourceId, setSourceId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api.listVersions(project.id).then((list: EditVersion[]) => {
      if (cancelled) return
      setVersions(list)
      setSourceId((list.find((version) => version.id === initialVersionId) || list[list.length - 1])?.id || '')
    }).catch(() => { if (!cancelled) setError('Không tải được phiên bản. Hãy mở lại màn hình Xuất.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [project.id])

  const source = versions.find((version) => version.id === sourceId)
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#f8fafc] text-slate-800 min-w-0">
      <header><h1 className="text-2xl font-bold">Xuất gói chỉnh sửa</h1></header>
      {loading ? <p role="status">Đang tải phiên bản...</p> : error ? <p role="alert" className="text-red-600 text-xs">{error}</p> : !source ? <div className="p-8 border border-dashed rounded-xl text-center space-y-3 text-slate-500"><Folder className="mx-auto" /><p>Chưa có bản dựng để xuất feedback.</p><button className={buttonClass} onClick={() => setActiveTab('versions')}>Đến Phiên bản</button></div> : <>
        <label className="block max-w-md text-xs space-y-2"><span className="font-semibold">Phiên bản nguồn</span><select aria-label="Phiên bản nguồn xuất" className={inputClass} value={sourceId} disabled={busy} onChange={(event) => { setSourceId(event.target.value); selectVersion(event.target.value) }}>
          {versions.map((version) => <option key={version.id} value={version.id}>V{version.versionNumber} — {version.name}</option>)}
        </select></label>
        <VersionExport key={source.id} project={project} source={source} onBusy={setBusy} />
      </>}
    </div>
  )
}

function VersionExport({ project, source, onBusy }: { project: Project; source: EditVersion; onBusy: (busy: boolean) => void }): React.ReactElement {
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [target, setTarget] = useState(`Draft V${source.versionNumber + 1}`)
  const [instructions, setInstructions] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')
  const [preview, setPreview] = useState<{ key: string; data: RevisionPackagePreview } | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [success, setSuccess] = useState<RevisionPackage | null>(null)
  const mounted = useRef(true)
  const exportLock = useRef(false)

  useEffect(() => {
    let cancelled = false
    mounted.current = true
    window.api.listComments(project.id, source.id).then((list: ReviewComment[]) => {
      if (cancelled) return
      setComments(list)
      setSelected(new Set(list.filter((comment) => comment.status !== 'FIXED' && comment.status !== 'REJECTED').map((comment) => comment.id)))
    }).catch(() => { if (!cancelled) setError('Không tải được bình luận. Hãy đổi phiên bản hoặc mở lại màn hình.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; mounted.current = false }
  }, [project.id, source.id])

  const dto: CreateRevisionPackageDTO = useMemo(() => ({
    projectId: project.id, sourceVersionId: source.id, targetVersionName: target,
    instructions, commentIds: [...selected].sort()
  }), [project.id, source.id, target, instructions, selected])
  const requestKey = JSON.stringify(dto)
  const currentPreview = preview?.key === requestKey ? preview.data : null
  const valid = !loading && selected.size > 0 && target.trim().length > 0 && target.trim() !== source.name.trim()

  useEffect(() => {
    let cancelled = false
    setSuccess(null)
    setPreview(null)
    setPreviewError('')
    if (!valid) { setPreviewing(false); return }
    setPreviewing(true)
    const timer = window.setTimeout(() => {
      window.api.previewPackage(dto).then((data: RevisionPackagePreview) => {
        if (!cancelled) setPreview({ key: requestKey, data })
      }).catch((err: unknown) => {
        if (!cancelled) setPreviewError(err instanceof Error ? err.message : 'Không thể xem trước gói.')
      }).finally(() => { if (!cancelled) setPreviewing(false) })
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [requestKey, valid])

  const visible = comments.filter((comment) => (statusFilter === 'ALL' || comment.status === statusFilter) && (priorityFilter === 'ALL' || comment.priority === priorityFilter))
  const visibleSelected = visible.filter((comment) => selected.has(comment.id)).length
  const toggleVisible = (include: boolean) => setSelected((old) => {
    const next = new Set(old)
    for (const comment of visible) { if (include) next.add(comment.id); else next.delete(comment.id) }
    return next
  })

  const exportPackage = async () => {
    if (exportLock.current || !currentPreview || !valid) return
    exportLock.current = true
    setExporting(true)
    onBusy(true)
    setError('')
    setSuccess(null)
    try {
      const result: RevisionPackage = await window.api.createPackage(dto)
      if (mounted.current) setSuccess(result)
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Không tạo được gói. Hãy thử lại.')
    } finally {
      exportLock.current = false
      if (mounted.current) { setExporting(false); onBusy(false) }
    }
  }

  const openFolder = async () => {
    if (!success) return
    try { await window.api.openPackageFolder(success.packagePath) }
    catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : 'Không mở được thư mục.') }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5">
      <fieldset disabled={exporting} className="space-y-5 min-w-0">
        <section className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
          <label className="block text-xs space-y-2"><span className="font-semibold">Tên phiên bản đích</span><input aria-label="Tên phiên bản đích" className={inputClass} maxLength={120} value={target} onChange={(event) => setTarget(event.target.value)} /></label>
        </section>
        <section className="bg-white p-4 rounded-2xl border border-slate-200 space-y-4">
          <h2 className="font-bold text-sm">Bình luận cần xuất</h2>
          <p className="text-xs text-slate-500">Đã chọn {selected.size}/{comments.length}; đang hiển thị {visible.length}.</p>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Lọc trạng thái xuất" className="p-2 border rounded-xl text-xs" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">Tất cả trạng thái</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select aria-label="Lọc ưu tiên xuất" className="p-2 border rounded-xl text-xs" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="ALL">Tất cả ưu tiên</option>{Object.entries(priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <button className={buttonClass} onClick={() => setSelected(new Set())}>Bỏ chọn tất cả</button>
          </div>
          {loading ? <p role="status" className="text-xs">Đang tải bình luận...</p> : !visible.length ? <p className="text-xs text-slate-500">{comments.length ? 'Không có bình luận phù hợp bộ lọc.' : 'Phiên bản này chưa có bình luận. Thêm feedback trong màn hình Duyệt.'}</p> : <div className="overflow-x-auto">
            <table className="w-full text-xs text-left"><thead className="text-slate-500 bg-slate-50"><tr>
              <th className="p-2"><input aria-label="Chọn bình luận đang hiển thị" type="checkbox" checked={visible.length > 0 && visibleSelected === visible.length} onChange={(event) => toggleVisible(event.target.checked)} /></th><th className="p-2">ID / thời gian</th><th className="p-2">Nội dung</th><th className="p-2">Ưu tiên</th><th className="p-2">Trạng thái</th>
            </tr></thead><tbody>{visible.map((comment) => <tr key={comment.id} className="border-t border-slate-100">
              <td className="p-2"><input type="checkbox" aria-label={`Xuất ${comment.id}`} checked={selected.has(comment.id)} onChange={(event) => { const include = event.target.checked; setSelected((old) => { const next = new Set(old); if (include) next.add(comment.id); else next.delete(comment.id); return next }) }} /></td>
              <td className="p-2 font-mono whitespace-nowrap">{comment.id}<br />{timeLabel(comment.timestamp)}</td><td className="p-2 whitespace-pre-wrap break-words max-w-xs">{comment.content}</td><td className="p-2">{priorities[comment.priority]}</td><td className="p-2">{statuses[comment.status]}</td>
            </tr>)}</tbody></table>
          </div>}
        </section>
        <section className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
          <label className="block text-xs space-y-2"><span className="font-semibold">Hướng dẫn cho agent/editor ({instructions.length}/2000)</span><textarea aria-label="Hướng dẫn chỉnh sửa" rows={6} maxLength={2000} className={inputClass} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Nêu rõ những gì cần sửa và cần giữ nguyên..." /></label>
        </section>
      </fieldset>
      <aside className="bg-white p-4 rounded-2xl border border-slate-200 space-y-4 h-fit min-w-0">
        <h2 className="font-bold text-sm flex gap-2 items-center"><Package size={16} />Xem trước gói</h2>
        {!valid && <p className="text-xs text-slate-500">Chọn ít nhất một bình luận và nhập tên đích khác tên nguồn để xem trước.</p>}
        {previewing && <p role="status" className="text-xs text-blue-600">Đang kiểm tra file và tạo preview...</p>}
        {previewError && <p role="alert" className="text-xs text-red-700 break-words">{previewError}</p>}
        {currentPreview && <>
          <ul aria-label="Danh sách file gói xuất" className="space-y-2 text-xs max-h-72 overflow-y-auto">{currentPreview.files.map((file) => <li key={file.path} className="flex justify-between gap-2 bg-slate-50 p-2 rounded-lg"><span className="font-mono break-all">{file.path}</span><span className="text-slate-400 shrink-0">{sizeLabel(file.size)}</span></li>)}</ul>
          <p className="text-xs font-semibold">{currentPreview.files.length} file · {sizeLabel(currentPreview.totalBytes)} · {currentPreview.review.reviews.length} bình luận</p>
          {currentPreview.warnings.map((warning, index) => <p key={index} className="text-xs text-amber-700">{warning}</p>)}
          <details className="text-xs"><summary className="cursor-pointer text-blue-600">Xem review.json</summary><pre className="mt-2 bg-slate-50 p-2 rounded-lg max-h-64 overflow-auto text-[10px]">{JSON.stringify(currentPreview.review, null, 2)}</pre></details>
        </>}
        {error && <p role="alert" className="text-xs text-red-700 break-words">{error}</p>}
        <button className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700 w-full`} disabled={exporting || previewing || !currentPreview || !valid} onClick={() => { void exportPackage() }}>{exporting ? 'Đang tạo gói...' : 'Tạo gói chỉnh sửa'}</button>
        {success && <div role="status" className="bg-emerald-50 p-3 rounded-xl space-y-2 text-xs"><p className="font-semibold text-emerald-700">Đã tạo gói chỉnh sửa.</p><p aria-label="Đường dẫn gói đã xuất" className="break-all">{success.packagePath}</p><button className={buttonClass} onClick={() => { void openFolder() }}>Mở thư mục gói</button></div>}
      </aside>
    </div>
  )
}
