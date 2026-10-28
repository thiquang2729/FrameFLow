import React, { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { AnalysisReview, SourceAnalysisRun, SourceScores } from '../../../shared/types/source-analysis'

export const sourceTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${(seconds % 60).toFixed(2).padStart(5, '0')}`
}
const scoreLabel = (value: number | null) => value === null ? '—' : value.toFixed(1)
const componentLabels: [keyof Pick<SourceScores, 'sharpness' | 'stability' | 'exposure' | 'composition' | 'audio'>, string][] = [
  ['sharpness', 'Độ nét'], ['stability', 'Ổn định'], ['exposure', 'Phơi sáng'], ['composition', 'Bố cục'], ['audio', 'Âm thanh']
]

export function SourceAnalysisPanel({ projectId, sourceId, run, onSeek, onRefresh }: {
  projectId: string; sourceId: string; run: SourceAnalysisRun | null;
  onSeek: (time: number) => void; onRefresh: () => Promise<void>
}): React.JSX.Element {
  const [note, setNote] = useState('')
  const [tags, setTags] = useState('')
  const [review, setReview] = useState<AnalysisReview>('UNREVIEWED')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    setNote(run?.userNote || '')
    setTags(run?.userTags.join(', ') || '')
    setReview(run?.review || 'UNREVIEWED')
    setMessage('')
  }, [run?.id])

  const save = async (next: AnalysisReview) => {
    if (!run) return
    setBusy(true); setMessage('')
    try {
      await window.api.sourceAnalysis.review(projectId, sourceId, run.id, next, note, tags.split(',').map((tag) => tag.trim()).filter(Boolean))
      setReview(next)
      await onRefresh()
      setMessage('Đã lưu đánh giá của bạn.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không lưu được đánh giá.') }
    finally { setBusy(false) }
  }

  if (!run) return <div className="src-analysis-empty">Chưa có đánh giá cho video này.</div>
  if (run.state !== 'COMPLETED') return <div className="src-analysis-empty" role="status">{run.state === 'RUNNING' ? 'Đang chuẩn bị hoặc gửi video tới AI...' : run.error || 'Lần phân tích chưa hoàn tất.'}</div>

  return <div className="src-analysis-results">
    {run.stale && <p className="src-notice src-notice--warning" role="status">{run.fileChanged ? 'File gốc đã thay đổi hoặc không còn truy cập được. Kết quả này thuộc bản trước.' : 'Brief dự án đã thay đổi. Điểm editorial cần được đánh giá lại.'}</p>}
    <div className="src-result-summary"><h3>Nội dung</h3><p>{run.summary}</p></div>
    <p className="src-result-provenance">{run.mediaNote} {!run.audioObserved && 'Âm thanh chưa được đánh giá.'}</p>
    {run.tags.length > 0 && <div className="src-tags" aria-label="Tag AI">{run.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}

    <div className="src-result-section"><h3>Đoạn video <span>{run.segments.length}</span></h3>
      <div className="src-segment-list">{run.segments.map((segment) => <article key={segment.id} className="src-segment">
        <button type="button" className="src-time-link" onClick={() => onSeek(segment.startTime)} disabled={run.fileChanged}>{sourceTime(segment.startTime)} → {sourceTime(segment.endTime)}</button>
        <p>{segment.summary}</p>
        <div className="src-score-pair"><span>Kỹ thuật <strong>{scoreLabel(segment.scores.technical)}<small>/10</small></strong></span><span>Biên tập <strong>{scoreLabel(segment.scores.editorial)}<small>/10</small></strong></span></div>
        <dl className="src-score-components">{componentLabels.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{scoreLabel(segment.scores[key])}</dd></div>)}</dl>
        <p className="src-score-rationale">{segment.scores.rationale}</p>
        <div className="src-segment-use"><span>{segment.shotType}</span><p>{segment.recommendedUse}</p></div>
      </article>)}</div>
    </div>

    <div className="src-result-section"><h3>Vấn đề <span>{run.issues.length}</span></h3>
      {!run.issues.length ? <p className="src-result-provenance">AI không ghi nhận vấn đề trong đoạn đã gửi.</p> : run.issues.map((issue) => <article key={issue.id} className="src-issue" data-severity={issue.severity}>
        <div><button type="button" className="src-time-link" onClick={() => onSeek(issue.startTime)} disabled={run.fileChanged}>{sourceTime(issue.startTime)}–{sourceTime(issue.endTime)}</button><span>{issue.type} · {issue.severity}</span></div>
        <p>{issue.description}</p><p className="src-score-rationale">{issue.evidence}</p>
      </article>)}
    </div>

    <div className="src-result-section src-user-review"><h3>Đánh giá của bạn</h3>
      <div className="src-review-actions"><button type="button" className="src-button" aria-pressed={review === 'ACCEPTED'} disabled={busy} onClick={() => void save('ACCEPTED')}><Check size={14} aria-hidden="true" />Đồng ý</button><button type="button" className="src-button" aria-pressed={review === 'REJECTED'} disabled={busy} onClick={() => void save('REJECTED')}><X size={14} aria-hidden="true" />Không đồng ý</button></div>
      <label htmlFor="src-user-tags">Tag của bạn</label><input id="src-user-tags" value={tags} maxLength={3000} onChange={(event) => setTags(event.target.value)} placeholder="Phân tách bằng dấu phẩy" />
      <label htmlFor="src-user-note">Ghi chú</label><textarea id="src-user-note" rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
      <button type="button" className="src-button" disabled={busy} onClick={() => void save(review)}>{busy ? 'Đang lưu...' : 'Lưu đánh giá'}</button>
      {message && <p role="status" className="src-result-provenance">{message}</p>}
    </div>
    <p className="src-result-provenance">{run.returnedModel || run.model} · {run.promptVersion} · {new Date(run.createdAt).toLocaleString('vi-VN')}</p>
  </div>
}
