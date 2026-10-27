import React, { useEffect, useRef, useState } from 'react'
import { Film, Folder, LayoutGrid, List, Search, Upload, X } from 'lucide-react'
import { Project, SourceAsset } from '@shared/types'
import { isSourceImage } from '@shared/media'
import { useProjectStore } from '../stores/project.store'
import { localFileUrl, probeSource } from '../lib/source-media'

const buttonClass = 'rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-50'
const unknown = 'Chưa xác định'
const pathKey = (value: string) => {
  const normalized = value.replace(/\\/g, '/')
  return /Windows/i.test(navigator.userAgent) ? normalized.toLowerCase() : normalized
}
const durationLabel = (value?: number) => value !== undefined && Number.isFinite(value)
  ? `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}` : unknown
const sizeLabel = (value = 0) => {
  if (!value) return '0 B'
  const unit = Math.min(3, Math.floor(Math.log(value) / Math.log(1024)))
  return `${(value / 1024 ** unit).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ${['B', 'KB', 'MB', 'GB'][unit]}`
}

export const SourceLibrary: React.FC = () => {
  const project = useProjectStore((state) => state.activeProject)
  if (!project) return <div className="flex-1 p-8 text-slate-500">Chọn một dự án để xem thư viện SRC.</div>
  return <ProjectSources key={project.id} project={project} />
}

function ProjectSources({ project }: { project: Project }): React.ReactElement {
  const refreshStats = useProjectStore((state) => state.refreshStats)
  const [sources, setSources] = useState<SourceAsset[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [report, setReport] = useState<string[]>([])
  const [progress, setProgress] = useState('')
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [sort, setSort] = useState('recent')
  const [previewError, setPreviewError] = useState('')
  const lifetime = useRef<AbortController>(new AbortController())
  const importingRef = useRef(false)
  const selected = sources.find((asset) => asset.id === selectedId)

  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    window.api.listSources(project.id).then((list: SourceAsset[]) => {
      if (controller.signal.aborted) return
      setSources(list)
      setSelectedId(list[0]?.id || null)
    }).catch(() => { if (!controller.signal.aborted) setError('Không thể tải thư viện. Hãy mở lại màn hình SRC.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [project.id])

  useEffect(() => setPreviewError(''), [selectedId])

  const importSources = async (folder: boolean) => {
    if (importingRef.current) return
    importingRef.current = true
    setImporting(true)
    setError('')
    setReport([])
    const signal = lifetime.current.signal
    const messages: string[] = []
    try {
      let paths: string[]
      if (folder) {
        const directory = await window.api.selectDirectory()
        if (!directory || signal.aborted) return
        setProgress('Đang quét thư mục...')
        paths = await window.api.scanSourceDirectory(directory)
      } else paths = await window.api.selectMediaFiles()
      if (signal.aborted) return
      if (!paths.length) { setReport(['Không có tệp media được chọn (video, JPG hoặc PNG).']); return }
      const knownPaths = new Set(sources.map((asset) => pathKey(asset.originalPath)))
      const knownIds = new Set(sources.map((asset) => asset.id))
      let imported = 0
      let duplicates = 0
      for (const [index, filePath] of [...new Set(paths)].entries()) {
        if (signal.aborted) break
        const filename = filePath.split(/[\\/]/).pop() || filePath
        setProgress(`${index + 1}/${paths.length} — ${filename}`)
        if (knownPaths.has(pathKey(filePath))) { duplicates++; continue }
        try {
          const result = await probeSource(filePath, signal)
          if (signal.aborted) break
          const asset: SourceAsset = await window.api.importSource({ projectId: project.id, filePath, filename, ...result.metadata })
          if (signal.aborted) break
          setSources((list) => [asset, ...list.filter((item) => item.id !== asset.id)])
          setSelectedId((current) => current || asset.id)
          knownPaths.add(pathKey(asset.originalPath))
          if (knownIds.has(asset.id)) duplicates++
          else { imported++; knownIds.add(asset.id) }
          if (result.warning) messages.push(`${filename}: ${result.warning}`)
        } catch (err) {
          if (signal.aborted) break
          messages.push(`${filename}: Không nhập được tệp. ${err instanceof Error ? err.message : ''}`)
        }
      }
      if (!signal.aborted) {
        setReport([`Đã nhập ${imported} tệp; bỏ qua ${duplicates} tệp đã có.`, ...messages])
        await refreshStats()
      }
    } catch (err) {
      if (!signal.aborted) setError(`Không thể nhập tư liệu. ${err instanceof Error ? err.message : ''}`)
    } finally {
      importingRef.current = false
      if (!signal.aborted) { setImporting(false); setProgress('') }
    }
  }

  const visible = sources.filter((asset) => `${asset.filename} ${asset.originalPath}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((a, b) => sort === 'name' ? a.filename.localeCompare(b.filename, 'vi') : sort === 'size' ? (b.fileSize || 0) - (a.fileSize || 0) : b.importedAt.localeCompare(a.importedAt))

  return (
    <div className="flex-1 flex overflow-hidden bg-[#f8fafc] text-slate-800 min-w-0">
      <main className="flex-1 overflow-y-auto min-w-0 p-6 space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-2xl font-bold">Thư viện SRC</h1><p className="text-xs text-slate-500 mt-1">{project.name} · {sources.length} tệp · {sizeLabel(sources.reduce((sum, asset) => sum + (asset.fileSize || 0), 0))}</p></div>
          <div className="flex gap-2"><button className={buttonClass} disabled={loading || importing} onClick={() => { void importSources(true) }}><Folder size={14} className="inline mr-1" />Nhập thư mục</button><button className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`} disabled={loading || importing} onClick={() => { void importSources(false) }}><Upload size={14} className="inline mr-1" />Nhập tư liệu</button></div>
        </header>
        <p className="text-xs text-slate-500">Chỉ lưu đường dẫn đến tệp gốc, không sao chép footage vào dự án. Di chuyển hoặc xóa tệp gốc sẽ làm preview không khả dụng.</p>
        {error && <p role="alert" className="text-xs text-red-700 bg-red-50 rounded-xl p-3">{error}</p>}
        {importing && <p role="status" className="text-xs text-blue-700">Đang nhập: {progress || 'Chờ chọn tệp...'}</p>}
        {report.length > 0 && <div role="status" className="text-xs bg-blue-50 border border-blue-100 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">{report.map((message, index) => <p key={index}>{message}</p>)}</div>}
        <div className="flex flex-wrap gap-3 items-center">
          <label className="relative flex-1 min-w-40"><Search size={14} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Tìm tư liệu" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên tệp hoặc đường dẫn..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs" /></label>
          <select aria-label="Sắp xếp tư liệu" value={sort} onChange={(event) => setSort(event.target.value)} className="border rounded-xl p-2 text-xs"><option value="recent">Mới nhập</option><option value="name">Tên tệp</option><option value="size">Dung lượng</option></select>
          <button aria-label="Dạng lưới" aria-pressed={view === 'grid'} className={buttonClass} onClick={() => setView('grid')}><LayoutGrid size={15} /></button><button aria-label="Dạng danh sách" aria-pressed={view === 'list'} className={buttonClass} onClick={() => setView('list')}><List size={15} /></button>
        </div>
        {loading ? <p role="status" className="text-xs text-slate-500">Đang tải thư viện...</p> : !visible.length ? <div className="p-10 border border-dashed rounded-2xl text-center text-slate-500"><Folder className="mx-auto mb-3" /><p className="text-sm">{sources.length ? 'Không có tư liệu phù hợp tìm kiếm.' : 'Chưa có tư liệu. Nhập tệp hoặc thư mục để bắt đầu.'}</p></div>
          : <div className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-2'}>
            {visible.map((asset) => <button key={asset.id} aria-label={`Xem tư liệu ${asset.filename}`} aria-pressed={selectedId === asset.id} onClick={() => setSelectedId(asset.id)} className={`text-left bg-white border rounded-xl overflow-hidden ${view === 'list' ? 'w-full flex items-center gap-3 p-2' : ''} ${selectedId === asset.id ? 'border-blue-500 ring-1 ring-blue-200' : 'border-slate-200 hover:border-slate-400'}`}>
              <div className={`bg-slate-900 flex items-center justify-center overflow-hidden ${view === 'grid' ? 'aspect-video w-full' : 'w-20 h-14 shrink-0 rounded-lg'}`}>
                {asset.thumbnailPath ? <img loading="lazy" src={localFileUrl(`${project.projectPath}/${asset.thumbnailPath}`)} alt="" className="w-full h-full object-contain" onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} /> : <Film className="text-slate-400" size={24} />}
              </div>
              <div className="p-3 min-w-0 space-y-1"><h2 className="text-xs font-bold truncate">{asset.filename}</h2><p className="text-[11px] text-slate-500">{isSourceImage(asset.filename) ? 'Ảnh' : durationLabel(asset.duration)} · {asset.width && asset.height ? `${asset.width}×${asset.height}` : unknown}</p><p className="text-[11px] text-slate-400">{sizeLabel(asset.fileSize)}</p></div>
            </button>)}
          </div>}
      </main>
      {selected && <aside className="w-80 shrink-0 border-l bg-white overflow-y-auto p-4 space-y-4">
        <div className="flex justify-between items-start gap-2"><h2 className="font-bold text-sm break-all">{selected.filename}</h2><button aria-label="Đóng chi tiết tư liệu" className="p-1 text-slate-400" onClick={() => setSelectedId(null)}><X size={16} /></button></div>
        {isSourceImage(selected.originalPath) ? <img key={selected.id} src={localFileUrl(selected.originalPath)} alt={selected.filename} className="w-full max-h-80 object-contain rounded-xl bg-black" onError={() => setPreviewError('Không đọc được ảnh. Kiểm tra vị trí tệp gốc.')} />
          : <video key={selected.id} src={localFileUrl(selected.originalPath)} controls preload="metadata" className="w-full max-h-80 rounded-xl bg-black" onError={() => setPreviewError('Không phát được video. Tệp có thể đã bị di chuyển hoặc codec chưa được hỗ trợ.')} />}
        {previewError && <p role="alert" className="text-xs text-red-600">{previewError}</p>}
        <dl className="text-xs space-y-3">
          {[
            ['Đường dẫn gốc', selected.originalPath], ['Loại', isSourceImage(selected.originalPath) ? 'Ảnh' : 'Video'],
            ['Thời lượng', isSourceImage(selected.originalPath) ? 'Không áp dụng' : durationLabel(selected.duration)],
            ['Độ phân giải', selected.width && selected.height ? `${selected.width}×${selected.height}` : unknown],
            ['FPS', selected.fps ? String(selected.fps) : unknown], ['Codec', selected.codec || unknown],
            ['Dung lượng', sizeLabel(selected.fileSize)], ['Ngày nhập', new Date(selected.importedAt).toLocaleString('vi-VN')]
          ].map(([label, value]) => <div key={label}><dt className="text-slate-400 mb-1">{label}</dt><dd className="break-all">{value}</dd></div>)}
        </dl>
        <p className="text-[11px] text-slate-400">Metadata cơ bản từ trình giải mã trình duyệt; chưa có phân tích AI. FPS/codec chỉ hiển thị khi có dữ liệu xác thực.</p>
      </aside>}
    </div>
  )
}
