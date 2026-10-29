import React, { useCallback, useEffect, useRef, useState } from 'react'
import { BadgeCheck, BrainCircuit, Copy, Lightbulb, Loader2, Maximize2, MessageSquare, Play, Plus, Sparkles, Tags, TriangleAlert, X, Zap } from 'lucide-react'
import type { Project, SourceAsset } from '@shared/types'
import type { SourceAnalysisRun, SourceScores } from '../../../shared/types/source-analysis'
import { isSourceImage } from '@shared/media'
import { localFileUrl } from '../../lib/source-media'
import { sourceTime } from './SourceAnalysisPanel'
import { issueLabels, mediaDuration, mediaResolution, mediaSize, scoreTone, tagTone } from './source-library-utils'

export function SourceLibraryInspector({ project, source, onClose, onOpenWorkspace, onRelink, onAnalysisChange, onOpenScript }: {
  project: Project; source: SourceAsset; onClose?: () => void; onOpenWorkspace: () => void;
  onRelink: () => Promise<void>; onAnalysisChange: () => Promise<void>; onOpenScript?: () => void
}): React.JSX.Element {
  const hasScript = Boolean(project.script?.trim())
  const qualityRows: [keyof Pick<SourceScores, 'sharpness' | 'stability' | 'exposure' | 'composition' | 'editorial'>, string][] = [
    ['sharpness', 'Độ sắc nét'],
    ['stability', 'Ổn định hình ảnh'],
    ['exposure', 'Phơi sáng'],
    ['composition', 'Bố cục'],
    ['editorial', hasScript ? 'Phù hợp kịch bản' : 'Giá trị biên tập']
  ]
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
  const [realigning, setRealigning] = useState(false)
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

  const handleQuickRealign = async () => {
    if (!run || realigning) return
    setRealigning(true)
    setError('')
    try {
      const env = await window.api.sourceAnalysis.environment()
      if (!env.aiReady) throw new Error('Chưa kết nối AI Antigravity. Hãy đăng nhập ở mục Kết nối AI.')
      const model = env.selectedModel || env.models[0] || run.model
      const startResult = await window.api.sourceAnalysis.start({
        projectId: project.id,
        sourceAssetId: source.id,
        model,
        startTime: run.startTime,
        endTime: run.endTime,
        consent: true
      })
      await window.api.sourceAnalysis.wait(project.id, source.id, startResult.id)
      await refresh()
      await onAnalysisChange()
    } catch (err) {
      if (active.current) setError(err instanceof Error ? err.message : 'Lỗi khi cập nhật kịch bản.')
    } finally {
      if (active.current) setRealigning(false)
    }
  }

  const visibleTags = [...new Set([...(run?.userTags || []), ...(valid ? run?.tags || [] : [])])]

  return <aside className="slib-inspector" aria-label={`Chi tiết SRC ${source.filename}`}>
    <div className="slib-preview">
      {image ? <img src={localFileUrl(source.originalPath)} alt={source.filename} onError={() => setPreviewError('Không đọc được ảnh gốc.')} /> :
        <video ref={video} src={localFileUrl(source.originalPath)} poster={source.thumbnailPath ? localFileUrl(`${project.projectPath}/${source.thumbnailPath}`) : undefined} controls preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onLoadedMetadata={() => { if (pendingSeek.current !== null && video.current) { video.current.currentTime = pendingSeek.current; pendingSeek.current = null } }} onError={() => setPreviewError('Không phát được video. Kiểm tra tệp gốc hoặc codec.')} />}
      {!image && !playing && !previewError && <button type="button" className="slib-preview-play" aria-label={`Phát SRC ${source.filename}`} onClick={() => { void video.current?.play().catch(() => setPreviewError('Không phát được video. Kiểm tra codec hoặc mở trình xem lớn.')) }}><Play size={23} fill="currentColor" aria-hidden="true" /></button>}
      {onClose && <button type="button" className="slib-preview-close" aria-label="Đóng chi tiết tư liệu" onClick={onClose}><X size={16} aria-hidden="true" /></button>}
      <button type="button" className="slib-preview-expand" aria-label="Mở trình xem SRC lớn" onClick={openWorkspace}><Maximize2 size={15} aria-hidden="true" /></button>
    </div>
    <div className="slib-inspector-identity"><h2 title={source.filename}>{source.filename}</h2><p>{image ? 'Ảnh' : mediaDuration(source.duration)}<span>·</span>{mediaResolution(source.width, source.height)}<span>·</span>{mediaSize(source.fileSize)}<span>·</span>{new Date(source.importedAt).toLocaleDateString('vi-VN')}</p></div>
    {visibleTags.length > 0 && <div className="slib-tags slib-inspector-top-tags">{visibleTags.slice(0, 3).map((tag) => <span key={tag} data-tone={tagTone(tag)}>{tag}</span>)}</div>}
    {previewError && <div className="slib-notice slib-notice--error" role="alert"><p>{previewError}</p><button type="button" className="slib-text-button" onClick={() => { void onRelink().catch((err) => setError(String(err))) }}>Liên kết lại tệp</button></div>}
    {error && <p role="alert" className="slib-notice slib-notice--error">{error}</p>}
    {notice && <p role="status" className="slib-notice">{notice}</p>}
    {run?.stale && (
      <div className="slib-notice slib-notice--warning" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ margin: 0 }}>
          {run.fileChanged
            ? 'File gốc đã thay đổi hoặc không còn truy cập được.'
            : run.criteriaChanged
            ? 'Tiêu chí đã đổi: bỏ âm thanh và không trừ điểm do xoay 90°.'
            : 'Kịch bản / Brief đã thay đổi.'}{' '}
          Cần cập nhật để khớp điểm mới.
        </p>
        {run.briefChanged && !run.fileChanged && (
          <button
            type="button"
            className="slib-button slib-button--batch"
            style={{ minHeight: 26, padding: '2px 8px', fontSize: 10, alignSelf: 'flex-start' }}
            disabled={realigning}
            onClick={() => void handleQuickRealign()}
            title="Tự động đọc lại JSON bóc tách cũ và đối chiếu với kịch bản mới mà không tải lại video"
          >
            {realigning ? (
              <>
                <Loader2 size={12} className="animate-spin text-blue-600" />
                <span>Đang đối chiếu JSON (~1s)...</span>
              </>
            ) : (
              <>
                <Zap size={11} className="text-amber-500 fill-amber-500" />
                <span>Cập nhật kịch bản siêu tốc (~1s từ JSON)</span>
              </>
            )}
          </button>
        )}
      </div>
    )}
    {run?.review === 'REJECTED' && <p className="slib-notice slib-notice--warning">Bạn đã bác bỏ kết quả này. Điểm không được dùng để lọc clip.</p>}

    {!image && <>
      {hasScript ? (
        <div className="slib-script-badge" title="AI đối chiếu và chấm điểm dựa trên kịch bản phân cảnh của dự án">
          <Sparkles size={12} className="text-amber-500" />
          <span>Đánh giá theo kịch bản</span>
          {onOpenScript && (
            <button type="button" className="slib-text-button" style={{ marginLeft: 6, fontSize: 10 }} onClick={onOpenScript}>
              (Xem / sửa kịch bản)
            </button>
          )}
        </div>
      ) : (
        onOpenScript && (
          <button type="button" className="slib-script-hint-button" onClick={onOpenScript}>
            <Sparkles size={12} />
            <span>Thêm kịch bản để AI chấm độ khớp phân cảnh</span>
          </button>
        )
      )}

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

      {run && run.dialogue && run.dialogue.length > 0 && (
        <section className="slib-detail-section slib-detail-section--dialogue">
          <header>
            <h3><MessageSquare size={17} aria-hidden="true" />Lời thoại VJ</h3>
            <span className="slib-section-count">{run.dialogue.length}</span>
          </header>
          <div className="slib-issue-list">
            {run.dialogue.map((line, idx) => (
              <button
                type="button"
                key={line.id || `dia_${idx}`}
                disabled={run.fileChanged}
                onClick={() => seek(line.startTime)}
                title={`Bấm để chuyển tới ${sourceTime(line.startTime)}`}
              >
                <span className="slib-issue-meta">
                  {sourceTime(line.startTime)}–{sourceTime(line.endTime)} · {line.speaker || 'VJ'}
                </span>
                <span className="italic text-slate-700">"{line.text}"</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="slib-detail-section slib-detail-section--use">
        <header><h3><Lightbulb size={17} aria-hidden="true" />Cách dùng tốt nhất</h3></header>
        <p className="slib-summary">
          {hasScript && segment?.recommendedUse && <span className="slib-badge-script">Khớp kịch bản:</span>}
          {segment?.recommendedUse || 'Chưa có gợi ý sử dụng.'}
        </p>
        {segment && <button type="button" className="slib-text-button" disabled={run?.fileChanged} onClick={() => seek(segment.startTime)}>Xem đoạn {sourceTime(segment.startTime)}–{sourceTime(segment.endTime)}</button>}
      </section>

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
