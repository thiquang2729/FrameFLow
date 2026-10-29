import React, { useEffect, useRef, useState } from 'react'
import { Maximize, RefreshCw, X } from 'lucide-react'
import type { Project, SourceAsset } from '@shared/types'
import type { SourceAnalysisEnvironment, SourceAnalysisRun, SourceMediaInfo } from '../../../shared/types/source-analysis'
import { isSourceImage } from '@shared/media'
import { localFileUrl } from '../../lib/source-media'
import { SourceAnalysisPanel, sourceTime } from './SourceAnalysisPanel'
import './source-workspace.css'

const stateNames: Record<SourceAnalysisRun['state'], string> = { RUNNING: 'Đang phân tích', COMPLETED: 'Đã có phản hồi AI', FAILED: 'Thất bại', CANCELLED: 'Đã hủy', INTERRUPTED: 'Bị gián đoạn' }

export function SourceWorkspace({ source, project, onClose, onMetadata }: {
  source: SourceAsset; project: Project; onClose: () => void; onMetadata: () => Promise<void>
}): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const alive = useRef(true)
  const listLoading = useRef(false)
  const probeLoading = useRef(false)
  const pendingRunId = useRef('')
  const [environment, setEnvironment] = useState<SourceAnalysisEnvironment | null>(null)
  const [info, setInfo] = useState<SourceMediaInfo | null>(null)
  const [runs, setRuns] = useState<SourceAnalysisRun[]>([])
  const [runId, setRunId] = useState('')
  const [model, setModel] = useState('')
  const [start, setStart] = useState('0')
  const [end, setEnd] = useState(String(Math.floor(Math.min(source.duration || 60, 60) * 1000) / 1000))
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackDuration, setPlaybackDuration] = useState(source.duration || 0)
  const [mediaError, setMediaError] = useState('')
  const image = isSourceImage(source.originalPath)
  const run = runs.find((item) => item.id === runId) || null
  const running = runs.find((item) => item.state === 'RUNNING')

  const refreshRuns = async () => {
    if (listLoading.current) return
    listLoading.current = true
    try {
      const next = await window.api.sourceAnalysis.list(project.id, source.id)
      if (!alive.current) return
      setRuns(next)
      if (pendingRunId.current && next.some((item) => item.id === pendingRunId.current)) {
        setRunId(pendingRunId.current)
        pendingRunId.current = ''
        return
      }
      setRunId((previous) => next.some((item) => item.id === previous) ? previous : next[0]?.id || '')
    } finally { listLoading.current = false }
  }
  const refreshEnvironment = async () => {
    const next = await window.api.sourceAnalysis.environment()
    if (!alive.current) return
    setEnvironment(next)
    setModel((previous) => next.models.includes(previous) ? previous : next.models.includes(next.selectedModel) ? next.selectedModel : next.models[0] || '')
  }
  const probe = async () => {
    if (probeLoading.current) return
    probeLoading.current = true
    try {
      const next = await window.api.sourceAnalysis.probe(project.id, source.id)
      if (!alive.current) return
      setInfo(next)
      setEnd((previous) => {
        const prevNum = Number(previous)
        const cleanNext = Math.floor(next.duration * 1000) / 1000
        const limit = Math.min(Number.isFinite(prevNum) && prevNum > 0 ? prevNum : 60, cleanNext, 60)
        return String(limit)
      })
      await onMetadata()
    } finally { probeLoading.current = false }
  }

  useEffect(() => {
    alive.current = true
    const previous = document.activeElement as HTMLElement | null
    const element = dialog.current
    if (element && !element.open) element.showModal()
    if (!image) {
      void Promise.all([refreshEnvironment(), refreshRuns()]).catch((err) => { if (alive.current) setError(err instanceof Error ? err.message : 'Không tải được dữ liệu phân tích.') })
    }
    const timer = setInterval(() => {
      if (!image) void refreshRuns().catch((err) => { if (alive.current) setError(err instanceof Error ? err.message : 'Không cập nhật được tác vụ.') })
    }, 2500)
    return () => { alive.current = false; clearInterval(timer); element?.close(); previous?.focus() }
  }, [])

  useEffect(() => {
    if (environment?.mediaReady && !image && !info) void probe().catch((err) => { if (alive.current) setError(err instanceof Error ? err.message : 'Không đọc được video.') })
  }, [environment?.mediaReady])
  useEffect(() => { setConsent(false) }, [model, start, end])

  const seek = (time: number) => {
    if (!video.current || !Number.isFinite(time)) return
    video.current.pause()
    const duration = video.current.duration
    video.current.currentTime = Math.max(0, Math.min(time, Number.isFinite(duration) ? duration : time))
  }
  const startAnalysis = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const created = await window.api.sourceAnalysis.start({ projectId: project.id, sourceAssetId: source.id, model, startTime: Number(start), endTime: Number(end), consent })
      if (!alive.current) return
      pendingRunId.current = created.id
      setRunId(created.id)
      await refreshRuns()
      setConsent(false)
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Không bắt đầu được phân tích.') }
    finally { if (alive.current) setBusy(false) }
  }
  const retryEnvironment = async () => {
    setBusy(true); setError('')
    try { await refreshEnvironment() }
    catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Không đọc được kết nối AI.') }
    finally { if (alive.current) setBusy(false) }
  }
  const duration = info?.duration || playbackDuration || source.duration || 0
  const startNum = Number(start)
  const endNum = Number(end)
  const validRange = Number.isFinite(startNum) && Number.isFinite(endNum) && startNum >= 0 && endNum > startNum && endNum - startNum <= 60 && (duration <= 0 || endNum <= duration + 0.05)

  return <dialog ref={dialog} className="src-workspace" aria-labelledby="src-workspace-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <header className="src-workspace-header"><div><h2 id="src-workspace-title">{source.filename}</h2><span>{project.name}</span></div><button type="button" className="src-button src-icon-button" aria-label="Đóng trình xem SRC" onClick={onClose}><X size={18} aria-hidden="true" /></button></header>
    <div className={`src-workspace-body${image ? ' src-workspace-body--image' : ''}`}>
      <div className="src-viewer">
        <div className="src-video-stage">{image ? <img src={localFileUrl(source.originalPath)} alt={source.filename} onError={() => setMediaError('Không đọc được ảnh. Kiểm tra tệp gốc.')} /> :
          <video ref={video} src={localFileUrl(source.originalPath)} controls preload="metadata" onLoadedMetadata={(event) => { const value = event.currentTarget.duration; if (Number.isFinite(value) && value > 0) setPlaybackDuration(value) }} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onError={() => setMediaError('Không phát được video. Tệp có thể đã bị di chuyển hoặc codec không được trình duyệt hỗ trợ.')} />}</div>
        {mediaError && <p role="alert" className="src-notice src-notice--error">{mediaError}</p>}
        {!image && <>
          <div className="src-viewer-toolbar"><span>{sourceTime(currentTime)} / {sourceTime(duration)}</span><button type="button" className="src-button" onClick={() => { void video.current?.requestFullscreen().catch(() => setMediaError('Không mở được chế độ toàn màn hình.')) }}><Maximize size={13} aria-hidden="true" />Toàn màn hình</button></div>
          {run?.state === 'COMPLETED' && !run.fileChanged && duration > 0 && <div className="src-segment-timeline" role="group" aria-label="Các đoạn AI trong video">{run.segments.map((segment, index) => <button key={segment.id} type="button" title={`${sourceTime(segment.startTime)} · ${segment.summary}`} aria-label={`Đoạn ${index + 1}: ${sourceTime(segment.startTime)}, ${segment.summary}`} style={{ left: `${segment.startTime / duration * 100}%`, width: `${(segment.endTime - segment.startTime) / duration * 100}%` }} onClick={() => seek(segment.startTime)}><span>{index + 1}</span></button>)}</div>}
          <form className="src-analysis-form" noValidate onSubmit={(event) => void startAnalysis(event)}>
            <div className="src-form-heading"><h3>Phân tích video</h3><button type="button" className="src-button src-icon-button" aria-label="Tải lại model và công cụ media" disabled={busy || Boolean(running)} onClick={() => void retryEnvironment()}><RefreshCw size={14} aria-hidden="true" /></button></div>
            <div className="src-analysis-fields"><div><label htmlFor="src-model">Model</label><select id="src-model" value={model} onChange={(event) => setModel(event.target.value)} disabled={!environment?.aiReady || busy || Boolean(running)}>{!environment?.models.length && <option value="">Chưa có model Gemini</option>}{environment?.models.map((name) => <option key={name} value={name}>{name}</option>)}</select></div><div><label htmlFor="src-start">Từ giây</label><input id="src-start" type="number" min={0} max={duration || undefined} step="any" value={start} onChange={(event) => setStart(event.target.value)} disabled={busy || Boolean(running)} /></div><div><label htmlFor="src-end">Đến giây</label><input id="src-end" type="number" min={0} max={duration ? Math.ceil(duration * 1000) / 1000 : undefined} step="any" value={end} onChange={(event) => setEnd(event.target.value)} disabled={busy || Boolean(running)} /></div></div>
            <div className="src-range-actions"><button type="button" className="src-time-link" disabled={Boolean(running)} onClick={() => setStart(String(Math.round(currentTime * 1000) / 1000))}>Đặt điểm đầu tại vị trí phát</button><button type="button" className="src-time-link" disabled={Boolean(running)} onClick={() => setEnd(String(Math.round(currentTime * 1000) / 1000))}>Đặt điểm cuối</button><span>Tối đa 60 giây / 12 MiB</span></div>
            {environment && !environment.mediaReady && <p role="status" className="src-notice src-notice--warning">{environment.mediaMessage}</p>}
            {environment && !environment.aiReady && <p role="status" className="src-notice src-notice--warning">Đăng nhập Antigravity trong mục Kết nối AI, sau đó tải lại model.</p>}
            {run?.stale && run.briefChanged && !run.fileChanged && (
              <p role="status" className="src-notice src-notice--warning" style={{ margin: '8px 0', fontSize: 11 }}>
                ⚡ <strong>Chế độ đối chiếu kịch bản siêu tốc:</strong> Clip này đã có sẵn dữ liệu bóc tách hình ảnh. Bấm "Phân tích video" sẽ tự động đối chiếu kịch bản từ JSON (~1–2 giây) mà không cần tải lại video.
              </p>
            )}
            <label className="src-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={busy || Boolean(running)} /><span>Tôi đồng ý gửi đoạn video tới AI và sử dụng hạn mức tài khoản. Video có thể kèm âm thanh gốc nhưng chỉ chấm điểm hình ảnh. Tuyến video Antigravity chưa được xác minh độc lập; không chuyển sang ảnh nếu bị từ chối.</span></label>
            <div className="src-submit-row"><span>{info ? `${info.width}×${info.height} · ${info.codec} · ${info.fps ? `${info.fps.toFixed(2)} FPS trung bình` : 'FPS chưa rõ'}` : 'Chưa đọc metadata bằng FFprobe'}</span>{running ? <button type="button" className="src-button" disabled={busy} onClick={() => { setBusy(true); void window.api.sourceAnalysis.cancel(project.id, source.id, running.id).catch((err) => setError(String(err))).finally(() => setBusy(false)) }}>Hủy phân tích</button> : <button type="submit" className="src-button src-button--primary" disabled={busy || !environment?.mediaReady || !environment.aiReady || !info || !model || !consent || !validRange}>{busy ? 'Đang bắt đầu...' : 'Phân tích video'}</button>}</div>
          </form>
          {error && <p className="src-notice src-notice--error" role="alert">{error}</p>}
        </>}
      </div>
      {!image && <aside className="src-analysis-sidebar"><div className="src-result-heading"><h3>Đánh giá SRC</h3><span>{runs.length} lần</span></div>{runs.length > 0 && <select className="src-run-select" aria-label="Lần phân tích SRC" value={runId} onChange={(event) => setRunId(event.target.value)}>{runs.map((item) => <option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString('vi-VN')} · {stateNames[item.state]}</option>)}</select>}<SourceAnalysisPanel projectId={project.id} sourceId={source.id} run={run} onSeek={seek} onRefresh={refreshRuns} /></aside>}
    </div>
  </dialog>
}
