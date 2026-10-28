import React, { useCallback, useEffect, useRef, useState } from 'react'
import { BadgeCheck, BrainCircuit, Copy, Lightbulb, Maximize2, Play, Plus, Tags, TriangleAlert, X } from 'lucide-react'
import type { Project, SourceAsset } from '@shared/types'
import type { SourceAnalysisRun, SourceScores } from '../../../shared/types/source-analysis'
import { isSourceImage } from '@shared/media'
import { localFileUrl } from '../../lib/source-media'
import { sourceTime } from './SourceAnalysisPanel'
import { issueLabels, mediaDuration, mediaResolution, mediaSize, scoreTone, tagTone } from './source-library-utils'

const qualityRows: [keyof Pick<SourceScores, 'sharpness' | 'stability' | 'exposure' | 'composition' | 'editorial'>, string][] = [
  ['sharpness', 'Độ sắc nét'], ['stability', 'Ổn định hình ảnh'], ['exposure', 'Phơi sáng'], ['composition', 'Bố cục'], ['editorial', 'Giá trị biên tập']
]

export function SourceLibraryInspector({ project, source, onClose, onOpenWorkspace, onRelink, onAnalysisChange }: {
  project: Project; source: SourceAsset; onClose: () => void; onOpenWorkspace: () => void;
  onRelink: () => Promise<void>; onAnalysisChange: () => Promise<void>
}): React.JSX.Element {
  const [runs, setRuns] = useState<SourceAnalysisRun[]>([])
  const [segmentId, setSegmentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [playing, setPlaying] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [editingTags, setEditingTags] = useState(false)
  const [userTags, setUserTags] = useState('')
  const [savingTags, setSavingTags] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const active = useRef(true)
  const fetching = useRef(false)
  const signature = useRef('')
  const image = isSourceImage(source.originalPath)
  const run = runs.find((item) => item.state === 'COMPLETED') || null
  const segment = run?.segments.find((item) => item.id === segmentId) || run?.segments[0] || null
  const valid = Boolean(run && !run.stale && run.review !== 'REJECTED')
  const scores = valid ? segment?.scores : null
  const latest = runs[0]
  const pendingSeek = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    if (fetching.current) return
    fetching.current = true
    try {
      const next = await window.api.sourceAnalysis.list(project.id, source.id)
      if (!active.current) return
      setRuns(next)
      const nextSignature = JSON.stringify(next.map((item) => [item.id, item.state, item.stale, item.review, item.userTags]))
      if (signature.current && signature.current !== nextSignature) void onAnalysisChange().catch(() => {})
      signature.current = nextSignature
    } catch (err) { if (active.current) setError(err instanceof Error ? err.message : 'Không tải được đánh giá SRC.') }
    finally { fetching.current = false; if (active.current) setLoading(false) }
  }, [project.id, source.id, onAnalysisChange])

  useEffect(() => {
    active.current = true
    if (!image) void refresh()
    else setLoading(false)
    const timer = setInterval(() => { if (!image) void refresh() }, 3500)
    return () => { active.current = false; clearInterval(timer) }
  }, [image, refresh])

  const seek = (time: number) => {
    if (!video.current || run?.fileChanged) return
    video.current.pause()
    if (video.current.readyState < 1) { pendingSeek.current = time; video.current.load(); return }
    video.current.currentTime = Math.max(0, Math.min(time, video.current.duration || time))
  }
  const openWorkspace = () => { video.current?.pause(); onOpenWorkspace() }
  const copy = async () => {
    if (!run) return
    try { await navigator.clipboard.writeText(run.summary); setNotice('Đã sao chép tóm tắt.') }
    catch { setError('Không sao chép được vào clipboard.') }
  }
  const saveTags = async () => {
    if (!run) return
    setSavingTags(true); setError('')
    try {
      await window.api.sourceAnalysis.review(project.id, source.id, run.id, run.review, run.userNote, userTags.split(',').map((tag) => tag.trim()).filter(Boolean))
      if (!active.current) return
      setEditingTags(false)
      await refresh()
      await onAnalysisChange()
    } catch (err) { if (active.current) setError(err instanceof Error ? err.message : 'Không lưu được tag.') }
    finally { if (active.current) setSavingTags(false) }
  }
  const visibleTags = [...new Set([...(run?.userTags || []), ...(valid ? run?.tags || [] : [])])]

  return <aside className="slib-inspector" aria-label={`Chi tiết SRC ${source.filename}`}>
    <div className="slib-preview">
      {image ? <img src={localFileUrl(source.originalPath)} alt={source.filename} onError={() => setPreviewError('Không đọc được ảnh gốc.')} /> :
        <video ref={video} src={localFileUrl(source.originalPath)} poster={source.thumbnailPath ? localFileUrl(`${project.projectPath}/${source.thumbnailPath}`) : undefined} controls preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onLoadedMetadata={() => { if (pendingSeek.current !== null && video.current) { video.current.currentTime = pendingSeek.current; pendingSeek.current = null } }} onError={() => setPreviewError('Không phát được video. Kiểm tra tệp gốc hoặc codec.')} />}
      {!image && !playing && !previewError && <button type="button" className="slib-preview-play" aria-label={`Phát SRC ${source.filename}`} onClick={() => { void video.current?.play().catch(() => setPreviewError('Không phát được video. Kiểm tra codec hoặc mở trình xem lớn.')) }}><Play size={23} fill="currentColor" aria-hidden="true" /></button>}
      <button type="button" className="slib-preview-close" aria-label="Đóng chi tiết tư liệu" onClick={onClose}><X size={16} aria-hidden="true" /></button>
      <button type="button" className="slib-preview-expand" aria-label="Mở trình xem SRC lớn" onClick={openWorkspace}><Maximize2 size={15} aria-hidden="true" /></button>
    </div>
    <div className="slib-inspector-identity"><h2 title={source.filename}>{source.filename}</h2><p>{image ? 'Ảnh' : mediaDuration(source.duration)}<span>·</span>{mediaResolution(source.width, source.height)}<span>·</span>{mediaSize(source.fileSize)}<span>·</span>{new Date(source.importedAt).toLocaleDateString('vi-VN')}</p></div>
    {visibleTags.length > 0 && <div className="slib-tags slib-inspector-top-tags">{visibleTags.slice(0, 3).map((tag) => <span key={tag} data-tone={tagTone(tag)}>{tag}</span>)}</div>}
    {previewError && <div className="slib-notice slib-notice--error" role="alert"><p>{previewError}</p><button type="button" className="slib-text-button" onClick={() => { void onRelink().catch((err) => setError(String(err))) }}>Liên kết lại tệp</button></div>}
    {error && <p role="alert" className="slib-notice slib-notice--error">{error}</p>}
    {notice && <p role="status" className="slib-notice">{notice}</p>}
    {run?.stale && <p className="slib-notice slib-notice--warning">{run.fileChanged ? 'File gốc đã thay đổi hoặc không còn truy cập được.' : run.criteriaChanged ? 'Tiêu chí đã đổi: bỏ âm thanh và không trừ điểm do xoay 90°.' : 'Brief đã thay đổi.'} Cần phân tích lại để cập nhật điểm.</p>}
    {run?.review === 'REJECTED' && <p className="slib-notice slib-notice--warning">Bạn đã bác bỏ kết quả này. Điểm không được dùng để lọc clip.</p>}

    {!image && <>
      <section className="slib-detail-section"><header><h3><BrainCircuit size={17} aria-hidden="true" />Tóm tắt AI</h3>{run && <button type="button" className="slib-icon-button" aria-label="Sao chép tóm tắt AI" onClick={() => void copy()}><Copy size={14} aria-hidden="true" /></button>}</header>
        <p className="slib-summary">{loading ? 'Đang tải đánh giá...' : run?.summary || (latest?.state === 'RUNNING' ? 'AI đang phân tích video.' : 'Chưa có đánh giá AI.')}</p>
        {latest && ['FAILED', 'CANCELLED', 'INTERRUPTED'].includes(latest.state) && <p className="slib-detail-note" role="status">{latest.error}</p>}
      </section>

      <section className="slib-detail-section"><header><h3><BadgeCheck size={17} aria-hidden="true" />Chất lượng</h3>{scores?.technical !== null && scores?.technical !== undefined && <span className="slib-quality-score" data-tone={scoreTone(scores.technical)} title="Điểm kỹ thuật của đoạn đang chọn">KT {scores.technical.toFixed(1)}</span>}</header>
        {run && run.segments.length > 0 && <select className="slib-segment-select" aria-label="Đoạn video đang đánh giá" value={segment?.id || ''} onChange={(event) => { setSegmentId(event.target.value); const next = run.segments.find((item) => item.id === event.target.value); if (next) seek(next.startTime) }}>{run.segments.map((item) => <option key={item.id} value={item.id}>{sourceTime(item.startTime)}–{sourceTime(item.endTime)}{item.shotType ? ` · ${item.shotType}` : ''}</option>)}</select>}
        <div className="slib-quality-bars">{qualityRows.map(([key, label]) => {
          const value = scores?.[key] ?? null
          return <div className="slib-quality-row" key={key}><span>{label}</span>{value === null ? <span className="slib-meter-empty" /> : <meter min={0} max={10} value={value} aria-label={`${label}: ${value.toFixed(1)} trên 10`} />}<strong>{value === null ? '—' : value.toFixed(1)}</strong></div>
        })}</div>
        {run?.mediaMethod === 'transcoded' && <p className="slib-detail-note">Đánh giá trên bản proxy chuyển mã, không phải chất lượng file gốc.</p>}
        {segment?.scores.rationale && <details className="slib-rationale"><summary>Cơ sở đánh giá</summary><p>{segment.scores.rationale}</p></details>}
      </section>

      <section className="slib-detail-section slib-detail-section--issues"><header><h3><TriangleAlert size={17} aria-hidden="true" />Vấn đề</h3>{run && <span className="slib-section-count">{run.issues.length}</span>}</header>
        {run?.issues.length ? <div className="slib-issue-list">{run.issues.map((issue) => <button type="button" key={issue.id} disabled={run.fileChanged} onClick={() => seek(issue.startTime)} title={issue.evidence}><span className="slib-issue-meta">{sourceTime(issue.startTime)} · {issueLabels[issue.type]}<span data-severity={issue.severity}>{issue.severity}</span></span><span>{issue.description}</span></button>)}</div> : <p className="slib-summary">{run ? 'AI không ghi nhận vấn đề trong đoạn đã gửi.' : 'Chưa có dữ liệu.'}</p>}
      </section>

      <section className="slib-detail-section slib-detail-section--use"><header><h3><Lightbulb size={17} aria-hidden="true" />Cách dùng tốt nhất</h3></header><p className="slib-summary">{segment?.recommendedUse || 'Chưa có gợi ý sử dụng.'}</p>{segment && <button type="button" className="slib-text-button" disabled={run?.fileChanged} onClick={() => seek(segment.startTime)}>Xem đoạn {sourceTime(segment.startTime)}–{sourceTime(segment.endTime)}</button>}</section>

      <section className="slib-detail-section"><header><h3><Tags size={17} aria-hidden="true" />Thẻ AI & của bạn</h3><button type="button" className="slib-add-tag" disabled={!run} title={!run ? 'Cần có một kết quả phân tích trước khi thêm thẻ tại đây.' : 'Chỉnh sửa thẻ của bạn'} onClick={() => { setUserTags(run?.userTags.join(', ') || ''); setEditingTags((value) => !value) }}><Plus size={12} aria-hidden="true" />Thêm thẻ</button></header>
        {visibleTags.length ? <div className="slib-tags">{visibleTags.map((tag) => <span key={tag} data-tone={tagTone(tag)} title={run?.userTags.includes(tag) ? 'Tag của bạn' : 'Tag AI'}>{tag}</span>)}</div> : <p className="slib-summary">Chưa có thẻ.</p>}
        {editingTags && <form className="slib-tag-editor" onSubmit={(event) => { event.preventDefault(); void saveTags() }}><label htmlFor="slib-user-tags">Thẻ của bạn, phân cách bằng dấu phẩy</label><input id="slib-user-tags" autoFocus value={userTags} maxLength={3000} onChange={(event) => setUserTags(event.target.value)} /><div><button type="button" className="slib-button" disabled={savingTags} onClick={() => setEditingTags(false)}>Hủy</button><button type="submit" className="slib-button slib-button--primary" disabled={savingTags}>{savingTags ? 'Đang lưu...' : 'Lưu thẻ'}</button></div></form>}
      </section>
      <button type="button" className="slib-button slib-button--primary slib-analysis-button" onClick={openWorkspace}><BrainCircuit size={15} aria-hidden="true" />{latest?.state === 'RUNNING' ? 'Xem tác vụ đang chạy' : run ? 'Phân tích lại / xem lịch sử' : 'Phân tích video'}</button>
      {run && <p className="slib-inspector-provenance">{run.returnedModel || run.model} · {new Date(run.createdAt).toLocaleDateString('vi-VN')}</p>}
    </>}
    <details className="slib-file-details"><summary>Thông tin tệp gốc</summary><dl><div><dt>Đường dẫn</dt><dd>{source.originalPath}</dd></div><div><dt>Kích thước</dt><dd>{source.width && source.height ? `${source.width}×${source.height}` : 'Chưa xác định'}</dd></div><div><dt>FPS trung bình</dt><dd>{source.fps?.toFixed(2) || 'Chưa xác định'}</dd></div><div><dt>Codec</dt><dd>{source.codec || 'Chưa xác định'}</dd></div></dl></details>
  </aside>
}
