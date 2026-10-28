import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Film, Folder, LayoutGrid, List, Search, Upload, X, MoreVertical, Plus, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { Project, SourceAsset } from '@shared/types'
import { isSourceImage } from '@shared/media'
import { useProjectStore } from '../stores/project.store'
import { localFileUrl, probeSource } from '../lib/source-media'
import { SourceWorkspace } from '../components/source/SourceWorkspace'
import { SourceLibraryInspector } from '../components/source/SourceLibraryInspector'
import { issueLabels, mediaResolution, scoreTone, tagTone, usableAnalysis } from '../components/source/source-library-utils'
import type { SourceAnalysisOverview } from '../../shared/types/source-analysis'
import './source-library.css'

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
  if (!project) return <div className="slib-page slib-no-project"><Folder size={32} aria-hidden="true" /><h1>Thư viện SRC</h1><p>Chọn một dự án để xem tư liệu.</p></div>
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
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<SourceAnalysisOverview[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [technicalMin, setTechnicalMin] = useState('')
  const [editorialMin, setEditorialMin] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [issueFilter, setIssueFilter] = useState('')
  const [shotFilter, setShotFilter] = useState('')
  const [durationFilter, setDurationFilter] = useState('')
  const lifetime = useRef<AbortController>(new AbortController())
  const importingRef = useRef(false)
  const analysisLoading = useRef(false)
  const root = useRef<HTMLDivElement>(null)
  const selected = sources.find((asset) => asset.id === selectedId)
  const workspace = sources.find((asset) => asset.id === workspaceId)
  const analysisMap = new Map(analyses.map((item) => [item.sourceAssetId, item]))
  const availableTags = [...new Set(analyses.filter(usableAnalysis).flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b, 'vi'))
  const availableShots = [...new Set(analyses.filter(usableAnalysis).flatMap((item) => item.shotTypes))].sort((a, b) => a.localeCompare(b, 'vi'))
  const refreshAnalysis = useCallback(async () => {
    if (analysisLoading.current) return
    const signal = lifetime.current.signal
    analysisLoading.current = true
    try {
      const next = await window.api.sourceAnalysis.overview(project.id)
      if (!signal.aborted) setAnalyses(next)
    } finally { analysisLoading.current = false }
  }, [project.id])
  const refreshSources = useCallback(async () => {
    const signal = lifetime.current.signal
    const next: SourceAsset[] = await window.api.listSources(project.id)
    if (!signal.aborted) setSources(next)
  }, [project.id])
  const relink = async (sourceId: string) => {
    if (await window.api.sourceAnalysis.relink(project.id, sourceId)) await Promise.all([refreshSources(), refreshAnalysis()])
  }

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

  useEffect(() => {
    const signal = lifetime.current.signal
    void refreshAnalysis().catch((err) => { if (!signal.aborted) setError(err instanceof Error ? err.message : 'Không đọc được đánh giá SRC.') })
  }, [refreshAnalysis])

  useEffect(() => {
    if (workspaceId) root.current?.querySelector<HTMLVideoElement>('.slib-inspector video')?.pause()
  }, [workspaceId])

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

  const clearFilters = () => { setTechnicalMin(''); setEditorialMin(''); setTagFilter(''); setIssueFilter(''); setShotFilter(''); setDurationFilter('') }
  const activeFilters = [
    ...(technicalMin ? [{ key: 'technical', label: `Kỹ thuật ≥ ${technicalMin}`, clear: () => setTechnicalMin('') }] : []),
    ...(editorialMin ? [{ key: 'editorial', label: `Biên tập ≥ ${editorialMin}`, clear: () => setEditorialMin('') }] : []),
    ...(tagFilter ? [{ key: 'tag', label: tagFilter, clear: () => setTagFilter('') }] : []),
    ...(issueFilter ? [{ key: 'issue', label: issueFilter === 'any' ? 'Có vấn đề' : issueLabels[issueFilter], clear: () => setIssueFilter('') }] : []),
    ...(shotFilter ? [{ key: 'shot', label: shotFilter, clear: () => setShotFilter('') }] : []),
    ...(durationFilter ? [{ key: 'duration', label: durationFilter === 'short' ? '≤ 10 giây' : durationFilter === 'medium' ? '10–30 giây' : '> 30 giây', clear: () => setDurationFilter('') }] : [])
  ]
  const visible = sources.filter((asset) => {
    const ai = analysisMap.get(asset.id)
    const valid = usableAnalysis(ai)
    const haystack = `${asset.filename} ${asset.originalPath} ${valid ? [ai?.summary, ...ai?.tags || [], ...ai?.shotTypes || [], ...ai?.recommendedUses || []].join(' ') : ''}`.toLocaleLowerCase()
    if (!haystack.includes(search.toLocaleLowerCase().trim())) return false
    if (technicalMin && (!valid || ai?.technical === null || ai?.technical === undefined || ai.technical < Number(technicalMin))) return false
    if (editorialMin && (!valid || ai?.editorial === null || ai?.editorial === undefined || ai.editorial < Number(editorialMin))) return false
    if (tagFilter && (!valid || !ai?.tags.includes(tagFilter))) return false
    if (shotFilter && (!valid || !ai?.shotTypes.includes(shotFilter))) return false
    if (issueFilter && (!valid || !ai?.issueTypes.some((type) => issueFilter === 'any' || type === issueFilter))) return false
    if (durationFilter && (asset.duration === undefined || (durationFilter === 'short' ? asset.duration > 10 : durationFilter === 'medium' ? asset.duration <= 10 || asset.duration > 30 : asset.duration <= 30))) return false
    return true
  }).sort((a, b) => {
    if (sort === 'name') return a.filename.localeCompare(b.filename, 'vi')
    if (sort === 'size') return (b.fileSize || 0) - (a.fileSize || 0)
    if (sort === 'technical' || sort === 'editorial') {
      const aAnalysis = analysisMap.get(a.id); const bAnalysis = analysisMap.get(b.id)
      return (usableAnalysis(bAnalysis) ? bAnalysis?.[sort] ?? -1 : -1) - (usableAnalysis(aAnalysis) ? aAnalysis?.[sort] ?? -1 : -1)
    }
    return b.importedAt.localeCompare(a.importedAt)
  })
  const lastImported = sources.reduce((latest, item) => item.importedAt > latest ? item.importedAt : latest, '')

  return (
    <div className="slib-page" ref={root}>
      <header className="slib-header"><div><h1>Thư viện SRC</h1><div className="slib-project-meta"><Folder size={14} aria-hidden="true" /><span>{project.name}</span><span>·</span><span>{sources.length} tệp</span><span>·</span><span>{sizeLabel(sources.reduce((sum, asset) => sum + (asset.fileSize || 0), 0))}</span>{lastImported && <><span>·</span><span>Cập nhật {new Date(lastImported).toLocaleDateString('vi-VN')}</span></>}</div></div>
        <div className="slib-import-actions"><button type="button" className="slib-button" disabled={loading || importing} onClick={() => { void importSources(true) }}><Folder size={16} aria-hidden="true" />Nhập thư mục</button><button type="button" className="slib-button slib-button--primary" disabled={loading || importing} onClick={() => { void importSources(false) }}><Upload size={16} aria-hidden="true" />Nhập tư liệu</button></div>
      </header>
      {error && <p role="alert" className="slib-notice slib-notice--error">{error}</p>}
      {importing && <p role="status" className="slib-notice">Đang nhập: {progress || 'Chờ chọn tệp...'}</p>}
      {report.length > 0 && <div role="status" className="slib-import-report">{report.map((message, index) => <p key={index}>{message}</p>)}</div>}
      <div className={`slib-content${selected ? ' slib-content--inspecting' : ''}`}>
        <main className="slib-browser" aria-label="Danh sách tư liệu SRC">
          <div className="slib-toolbar"><label className="slib-search"><Search size={17} aria-hidden="true" /><input aria-label="Tìm tư liệu" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm clip nguồn, nội dung hoặc thẻ..." /></label><button type="button" className="slib-button slib-filter-toggle" aria-expanded={filtersOpen} aria-controls="slib-filters" onClick={() => setFiltersOpen((value) => !value)}><SlidersHorizontal size={15} aria-hidden="true" />Bộ lọc{activeFilters.length > 0 && <span>{activeFilters.length}</span>}</button><div className="slib-view-switch" aria-label="Kiểu hiển thị"><button type="button" aria-label="Dạng lưới" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={16} aria-hidden="true" /></button><button type="button" aria-label="Dạng danh sách" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={17} aria-hidden="true" /></button></div><select aria-label="Sắp xếp tư liệu" className="slib-sort" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Mới nhập</option><option value="name">Tên tệp</option><option value="size">Dung lượng</option><option value="technical">Điểm kỹ thuật</option><option value="editorial">Điểm biên tập</option></select></div>
          {filtersOpen && <div id="slib-filters" className="slib-filter-panel"><label>Kỹ thuật tối thiểu<select value={technicalMin} onChange={(event) => setTechnicalMin(event.target.value)}><option value="">Tất cả</option>{[6, 7, 8, 9].map((value) => <option key={value} value={value}>≥ {value}</option>)}</select></label><label>Biên tập tối thiểu<select value={editorialMin} onChange={(event) => setEditorialMin(event.target.value)}><option value="">Tất cả</option>{[6, 7, 8, 9].map((value) => <option key={value} value={value}>≥ {value}</option>)}</select></label><label>Loại cảnh<select value={shotFilter} onChange={(event) => setShotFilter(event.target.value)}><option value="">Tất cả</option>{availableShots.map((shot) => <option key={shot} value={shot}>{shot}</option>)}</select></label><label>Thẻ<select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option value="">Tất cả</option>{availableTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label><label>Vấn đề<select value={issueFilter} onChange={(event) => setIssueFilter(event.target.value)}><option value="">Tất cả</option><option value="any">Có vấn đề</option>{Object.entries(issueLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Thời lượng<select value={durationFilter} onChange={(event) => setDurationFilter(event.target.value)}><option value="">Tất cả</option><option value="short">≤ 10 giây</option><option value="medium">10–30 giây</option><option value="long">&gt; 30 giây</option></select></label></div>}
          <div className="slib-filter-strip"><div className="slib-active-filters">{activeFilters.map((filter) => <button type="button" key={filter.key} onClick={filter.clear}>{filter.label}<X size={12} aria-hidden="true" /><span className="sr-only">Bỏ bộ lọc</span></button>)}{activeFilters.length ? <button type="button" className="slib-clear-filters" onClick={clearFilters}>Xóa tất cả</button> : <><button type="button" className="slib-suggested-filter" onClick={() => setTechnicalMin('8')}>Kỹ thuật ≥ 8</button><button type="button" className="slib-suggested-filter" onClick={() => setEditorialMin('8')}>Biên tập ≥ 8</button></>}</div><span className="slib-visible-count" role="status">{visible.length} {sources.some((item) => isSourceImage(item.filename)) ? 'tệp' : 'clip'}</span></div>
          {loading ? <p role="status" className="slib-empty">Đang tải thư viện...</p> : !visible.length ? <div className="slib-empty"><Folder size={32} aria-hidden="true" /><p>{sources.length ? 'Không có tư liệu phù hợp.' : 'Chưa có tư liệu. Nhập tệp hoặc thư mục để bắt đầu.'}</p>{sources.length ? <button type="button" className="slib-button" onClick={() => { clearFilters(); setSearch('') }}>Xóa bộ lọc</button> : <button type="button" className="slib-button" onClick={() => { void importSources(false) }}>Nhập tư liệu</button>}</div> : <div className={`slib-assets slib-assets--${view}`}>
            {visible.map((asset) => {
              const ai = analysisMap.get(asset.id)
              const valid = usableAnalysis(ai)
              const tags = valid ? [...new Set([...(ai?.tags || []), ...(ai?.shotTypes || []).slice(0, 1)])] : []
              return <article key={asset.id} className="slib-asset" data-selected={selectedId === asset.id}>
                <button type="button" className="slib-thumbnail" aria-label={`Xem tư liệu ${asset.filename}`} aria-pressed={selectedId === asset.id} onClick={() => setSelectedId(asset.id)} onDoubleClick={() => setWorkspaceId(asset.id)}>
                  {asset.thumbnailPath ? <img key={asset.thumbnailPath} loading="lazy" src={localFileUrl(`${project.projectPath}/${asset.thumbnailPath}`)} alt="" onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} /> : <Film className="slib-thumbnail-placeholder" size={28} aria-hidden="true" />}
                  <span className="slib-duration">{isSourceImage(asset.filename) ? 'Ảnh' : durationLabel(asset.duration)}</span>
                  {valid && <span className="slib-thumbnail-scores">{ai?.technical !== null && ai?.technical !== undefined && <span data-tone={scoreTone(ai.technical)} title={`Kỹ thuật đoạn ${durationLabel(ai.startTime ?? undefined)}–${durationLabel(ai.endTime ?? undefined)}`}>KT {ai.technical.toFixed(1)}</span>}{ai?.editorial !== null && ai?.editorial !== undefined && <span data-tone={scoreTone(ai.editorial)} title={`Biên tập đoạn ${durationLabel(ai.startTime ?? undefined)}–${durationLabel(ai.endTime ?? undefined)}`}>BT {ai.editorial.toFixed(1)}</span>}</span>}
                  {ai?.latestState === 'RUNNING' && <span className="slib-analysis-state">Đang phân tích</span>}
                  {ai?.stale && ai.latestState !== 'RUNNING' && <span className="slib-analysis-state slib-analysis-state--warning">Cần cập nhật</span>}
                </button>
                <div className="slib-asset-body"><div className="slib-asset-title"><button type="button" onClick={() => setSelectedId(asset.id)} title={asset.filename}>{asset.filename}</button><details className="slib-asset-menu"><summary aria-label={`Tùy chọn ${asset.filename}`}><MoreVertical size={17} aria-hidden="true" /></summary><div><button type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); setWorkspaceId(asset.id) }}>Xem lớn / đánh giá</button><button type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); void relink(asset.id).catch((err) => setError(err instanceof Error ? err.message : 'Không liên kết lại được tệp.')) }}>Liên kết lại tệp</button></div></details></div>
                <div className="slib-tags slib-card-tags">{tags.length ? tags.slice(0, 3).map((tag) => <button type="button" key={tag} data-tone={tagTone(tag)} onClick={() => availableTags.includes(tag) ? setTagFilter(tag) : setShotFilter(tag)}>{tag}</button>) : <span className="slib-unanalysed">{isSourceImage(asset.filename) ? 'Ảnh nguồn' : ai?.rejected ? 'Đánh giá đã bác bỏ' : ai?.latestState === 'FAILED' ? 'Phân tích thất bại' : ai?.latestState === 'RUNNING' ? 'Đang phân tích' : 'Chưa có thẻ AI'}</span>}</div>
                <p className="slib-asset-meta"><span>{mediaResolution(asset.width, asset.height)}</span><span>·</span><span>{sizeLabel(asset.fileSize)}</span><span>·</span><span>{new Date(asset.importedAt).toLocaleDateString('vi-VN')}</span></p></div>
              </article>
            })}
          </div>}
        </main>
        {selected && <SourceLibraryInspector key={`${selected.id}:${selected.originalPath}`} source={selected} project={project} onClose={() => setSelectedId(null)} onOpenWorkspace={() => setWorkspaceId(selected.id)} onRelink={() => relink(selected.id)} onAnalysisChange={refreshAnalysis} />}
      </div>
      {workspace && <SourceWorkspace key={workspace.id} source={workspace} project={project} onClose={() => { setWorkspaceId(null); void Promise.all([refreshSources(), refreshAnalysis()]).catch((err) => { if (!lifetime.current.signal.aborted) setError(String(err)) }) }} onMetadata={refreshSources} />}
    </div>
  )
}
