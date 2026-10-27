import React, { useEffect, useRef, useState } from 'react'
import { Film, Plus, X } from 'lucide-react'
import { EditVersion, Project } from '@shared/types'
import { useProjectStore } from '../stores/project.store'
import { probeSource } from '../lib/source-media'

const buttonClass = 'px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium hover:bg-slate-50 disabled:opacity-40'
const inputClass = 'w-full p-2 rounded-xl border border-slate-200 text-xs bg-white'

export const VersionList: React.FC = () => {
  const project = useProjectStore((state) => state.activeProject)
  if (!project) return <div className="flex-1 p-8 text-slate-500">Chọn một dự án để xem phiên bản dựng.</div>
  return <ProjectVersions key={project.id} project={project} />
}

function ProjectVersions({ project }: { project: Project }): React.ReactElement {
  const { openReview, refreshStats } = useProjectStore()
  const [versions, setVersions] = useState<EditVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [videoPath, setVideoPath] = useState('')
  const [fps, setFps] = useState('30')
  const [parentId, setParentId] = useState('')
  const [importing, setImporting] = useState(false)
  const [warning, setWarning] = useState('')
  const lifetime = useRef(new AbortController())
  const lock = useRef(false)
  const nextNumber = Math.max(0, ...versions.map((version) => Number.isSafeInteger(version.versionNumber) ? version.versionNumber : 0)) + 1

  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    setLoading(true)
    window.api.listVersions(project.id).then((list: EditVersion[]) => {
      if (!controller.signal.aborted) setVersions(list)
    }).catch(() => { if (!controller.signal.aborted) setError('Không tải được phiên bản. Vui lòng thử lại.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [project.id, reload])

  const startImport = () => {
    setName(`Draft V${nextNumber}`)
    setVideoPath('')
    setParentId(versions[versions.length - 1]?.id || '')
    setError('')
    setWarning('')
    setShowModal(true)
  }
  const selectFile = async () => {
    try {
      const selected = await window.api.selectVideoFile()
      if (!lifetime.current.signal.aborted && selected) setVideoPath(selected)
    } catch { if (!lifetime.current.signal.aborted) setError('Không mở được hộp thoại chọn video.') }
  }
  const importVersion = async (event: React.FormEvent) => {
    event.preventDefault()
    if (lock.current || !videoPath || !name.trim()) return
    lock.current = true
    setImporting(true)
    setError('')
    setWarning('')
    const signal = lifetime.current.signal
    try {
      const probe = await probeSource(videoPath, signal)
      if (signal.aborted) return
      if (!probe.metadata.width || !probe.metadata.height) throw new Error('Không giải mã được video. Kiểm tra tệp hoặc thử MP4 H.264/WebM.')
      const version: EditVersion = await window.api.createVersion({
        projectId: project.id, versionNumber: nextNumber, name: name.trim(), videoPath,
        parentVersionId: parentId || null, duration: probe.metadata.duration,
        width: probe.metadata.width, height: probe.metadata.height, fps: Number(fps), createdBy: 'USER'
      })
      if (signal.aborted) return
      setVersions((list) => [...list, version].sort((a, b) => a.versionNumber - b.versionNumber))
      setWarning(probe.warning || '')
      setShowModal(false)
      await refreshStats()
    } catch (err) {
      if (!signal.aborted) setError(err instanceof Error ? err.message : 'Không nhập được phiên bản.')
    } finally {
      lock.current = false
      if (!signal.aborted) setImporting(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#f8fafc] text-slate-800 min-w-0">
      <header className="flex justify-between items-start gap-3"><div><h1 className="text-2xl font-bold">Phiên bản dựng</h1><p className="text-xs text-slate-500 mt-1">{project.name} · Mỗi feedback luôn thuộc đúng phiên bản video.</p></div><button className={`${buttonClass} flex gap-2 items-center`} disabled={loading} onClick={startImport}><Plus size={14} />Thêm bản dựng mới</button></header>
      {error && !showModal && <div role="alert" className="text-xs text-red-700 space-x-3"><span>{error}</span><button className={buttonClass} onClick={() => { setError(''); setReload((value) => value + 1) }}>Tải lại</button></div>}
      {warning && <p role="status" className="text-xs text-amber-700">{warning}</p>}
      {loading ? <p role="status" className="text-xs text-slate-500">Đang tải phiên bản...</p> : !versions.length ? <div className="p-10 border border-dashed rounded-2xl text-center text-slate-500 space-y-3"><Film className="mx-auto" /><p>Chưa có bản dựng. Nhập video đầu tiên để bắt đầu review.</p></div> : <div className="space-y-3">
        {[...versions].reverse().map((version) => <article key={version.id} className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1"><h2 className="text-sm font-bold">V{version.versionNumber} — {version.name}{version.id === versions[versions.length - 1].id && <span className="ml-2 text-[10px] text-blue-600">MỚI NHẤT</span>}</h2>
            <p className="text-xs text-slate-500 break-all">{version.videoPath}</p>
            <p className="text-[11px] text-slate-400">{version.duration ? `${version.duration.toFixed(2)}s` : 'Chưa rõ thời lượng'} · {version.width && version.height ? `${version.width}×${version.height}` : 'Chưa rõ độ phân giải'}{version.width && version.height && version.height > version.width && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold text-[10px]">9:16 Dọc</span>} · FPS ước tính: {version.fps ?? 'chưa nhập'} · {new Date(version.createdAt).toLocaleString('vi-VN')}</p>
            <p className="text-[11px] text-slate-500">{version.parentVersionId ? `Kế thừa: ${versions.find((parent) => parent.id === version.parentVersionId)?.name || version.parentVersionId} → ${version.name}` : 'Phiên bản gốc (không có cha)'}</p>
          </div><button aria-label={`Duyệt ${version.name}`} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`} onClick={() => openReview(version.id)}>Duyệt bản dựng</button>
        </article>)}
      </div>}
      {showModal && <div role="dialog" aria-modal="true" aria-label="Nhập phiên bản dựng" className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
        <form onSubmit={(event) => { void importVersion(event) }} className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4">
          <div className="flex justify-between"><h2 className="font-bold text-sm">Nhập phiên bản V{nextNumber}</h2><button type="button" aria-label="Đóng nhập phiên bản" disabled={importing} onClick={() => setShowModal(false)}><X size={16} /></button></div>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <fieldset disabled={importing} className="space-y-3">
            <label className="block text-xs space-y-1"><span>Tên phiên bản</span><input aria-label="Tên phiên bản nhập" required maxLength={120} className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <div className="space-y-1"><p className="text-xs">Video (giữ đường dẫn gốc, không copy)</p><div className="flex gap-2"><input aria-label="Đường dẫn video nhập" readOnly value={videoPath} className={`${inputClass} min-w-0`} /><button type="button" className={`${buttonClass} shrink-0`} onClick={() => { void selectFile() }}>Chọn tệp</button></div></div>
            <label className="block text-xs space-y-1"><span>Phiên bản cha</span><select aria-label="Phiên bản cha" className={inputClass} value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">Không có</option>{versions.map((version) => <option key={version.id} value={version.id}>V{version.versionNumber} — {version.name}</option>)}</select></label>
            <label className="block text-xs space-y-1"><span>FPS dùng ước tính frame (tự nhập, không được tự phát hiện)</span><input aria-label="FPS ước tính" type="number" min="1" max="240" step="0.001" required value={fps} onChange={(event) => setFps(event.target.value)} className={inputClass} /></label>
          </fieldset>
          <div className="flex justify-end gap-2"><button type="button" className={buttonClass} disabled={importing} onClick={() => setShowModal(false)}>Hủy</button><button type="submit" className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`} disabled={importing || !videoPath || !name.trim()}>{importing ? 'Đang nhập...' : 'Lưu phiên bản'}</button></div>
        </form>
      </div>}
    </div>
  )
}
