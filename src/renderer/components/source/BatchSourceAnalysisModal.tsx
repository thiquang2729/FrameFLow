import React, { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Film,
  Loader2,
  Minimize2,
  Play,
  RefreshCw,
  Sparkles,
  StopCircle,
  X,
  Zap
} from 'lucide-react'
import type { Project, SourceAsset } from '@shared/types'
import type { SourceAnalysisOverview } from '../../../shared/types/source-analysis'
import { isSourceImage } from '@shared/media'

export interface BatchItemState {
  id: string
  filename: string
  duration?: number
  status: 'pending' | 'probing' | 'analyzing' | 'completed' | 'failed' | 'cancelled'
  error?: string
  isRealign?: boolean
  technical?: number | null
  editorial?: number | null
  summary?: string
}

export interface BatchStatusReport {
  status: 'idle' | 'running' | 'completed' | 'cancelled'
  total: number
  completedCount: number
  failedCount: number
  remainingCount: number
  percent: number
  current: number
  currentFilename?: string
}

export interface BatchSourceAnalysisModalProps {
  isOpen: boolean
  onClose: () => void
  onMinimize?: () => void
  project: Project
  sources: SourceAsset[]
  analyses: SourceAnalysisOverview[]
  onStepComplete?: () => Promise<void> | void
  onBatchFinished?: () => Promise<void> | void
  onProgressChange?: (report: BatchStatusReport) => void
}

export function BatchSourceAnalysisModal({
  isOpen,
  onClose,
  onMinimize,
  project,
  sources,
  analyses,
  onStepComplete,
  onBatchFinished,
  onProgressChange
}: BatchSourceAnalysisModalProps): React.JSX.Element {
  const [model, setModel] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [aiReady, setAiReady] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [scope, setScope] = useState<'unanalyzed' | 'all'>('unanalyzed')
  const [forceFullVideo, setForceFullVideo] = useState(false)
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'cancelled'>('idle')
  const [items, setItems] = useState<BatchItemState[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)
  const cancelRequested = useRef(false)
  const isRunningRef = useRef(false)

  // Filter only video assets
  const videoAssets = sources.filter((s) => !isSourceImage(s.filename))
  const analysisMap = new Map(analyses.map((a) => [a.sourceAssetId, a]))
  const unanalyzedVideos = videoAssets.filter((v) => {
    const a = analysisMap.get(v.id)
    return !a || a.latestState !== 'COMPLETED' || a.stale
  })

  const realignEligibleCount = (scope === 'unanalyzed' ? unanalyzedVideos : videoAssets).filter((v) => {
    const a = analysisMap.get(v.id)
    return a?.latestState === 'COMPLETED' && Boolean(a?.stale) && Boolean(a?.briefChanged) && !a?.fileChanged
  }).length

  // Load environment & default model
  useEffect(() => {
    let active = true
    const loadEnv = async () => {
      try {
        const env = await window.api.sourceAnalysis.environment()
        if (!active) return
        setAiReady(env.aiReady)
        setAiMessage(env.mediaMessage || (env.aiReady ? '' : 'Hãy đăng nhập Antigravity trong mục Kết nối AI.'))
        setModels(env.models)
        setModel((current) => (env.models.includes(current) ? current : env.selectedModel || env.models[0] || ''))
      } catch (err) {
        if (active) setAiMessage(err instanceof Error ? err.message : 'Không kiểm tra được môi trường AI.')
      }
    }
    void loadEnv()
    return () => {
      active = false
    }
  }, [isOpen])

  // Initialize items only when idle
  useEffect(() => {
    if (status !== 'idle') return
    const targetAssets = scope === 'unanalyzed' ? unanalyzedVideos : videoAssets
    setItems(
      targetAssets.map((v) => {
        const a = analysisMap.get(v.id)
        const isRealign = !forceFullVideo && a?.latestState === 'COMPLETED' && Boolean(a?.stale) && Boolean(a?.briefChanged) && !a?.fileChanged
        return {
          id: v.id,
          filename: v.filename,
          duration: v.duration,
          status: 'pending',
          isRealign,
          technical: a?.technical,
          editorial: a?.editorial,
          summary: a?.summary
        }
      })
    )
  }, [scope, sources, analyses, status, forceFullVideo])

  const completedCount = items.filter((it) => it.status === 'completed').length
  const failedCount = items.filter((it) => it.status === 'failed').length
  const remainingCount = items.filter((it) => it.status !== 'completed').length
  const progressPercent = items.length > 0 ? Math.round(((completedCount + failedCount) / items.length) * 100) : 0
  const currentItem = status === 'running' ? items[currentIndex] : null
  const isRealignOnlyBatch = items.length > 0 && items.every((it) => it.isRealign)

  // Broadcast progress changes to parent for background sticky banner
  useEffect(() => {
    onProgressChange?.({
      status,
      total: items.length,
      completedCount,
      failedCount,
      remainingCount,
      percent: progressPercent,
      current: currentIndex,
      currentFilename: currentItem?.filename
    })
  }, [status, items.length, completedCount, failedCount, remainingCount, progressPercent, currentIndex, currentItem?.filename, onProgressChange])

  const handleReset = () => {
    cancelRequested.current = false
    isRunningRef.current = false
    setActiveRunId(null)
    setActiveAssetId(null)
    setCurrentIndex(0)
    setStatus('idle')
  }

  const runAnalysis = async (resume = false) => {
    if (!aiReady || !model || items.length === 0) return
    cancelRequested.current = false
    isRunningRef.current = true
    setStatus('running')

    if (!resume) {
      setItems((prev) => prev.map((it) => ({ ...it, status: 'pending', error: undefined })))
      setCurrentIndex(0)
    }

    for (let i = 0; i < items.length; i++) {
      if (cancelRequested.current) {
        setStatus('cancelled')
        break
      }

      const item = items[i]
      // In resume mode, skip already completed videos
      if (resume && item.status === 'completed') {
        continue
      }

      setCurrentIndex(i)

      // Step 1: Probe duration if missing
      setItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: 'probing', error: undefined } : it))
      )

      let duration = item.duration || 0
      if (!duration || duration <= 0) {
        try {
          const probed = await window.api.sourceAnalysis.probe(project.id, item.id)
          duration = probed.duration || 0
        } catch (probeErr) {
          // If probe fails, mark item failed and continue
          setItems((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? {
                    ...it,
                    status: 'failed',
                    error: probeErr instanceof Error ? probeErr.message : 'Lỗi đọc tệp video.'
                  }
                : it
            )
          )
          continue
        }
      }

      if (cancelRequested.current) {
        setStatus('cancelled')
        break
      }

      // Step 2: Start Analysis
      setItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: 'analyzing', duration } : it))
      )

      const endTime = Math.min(duration > 0 ? duration : 60, 60)
      setActiveAssetId(item.id)

      try {
        const startResult = await window.api.sourceAnalysis.start({
          projectId: project.id,
          sourceAssetId: item.id,
          model,
          startTime: 0,
          endTime,
          consent: true,
          forceFullVideo
        })

        setActiveRunId(startResult.id)

        // Step 3: Wait for analysis completion
        const outcome = await window.api.sourceAnalysis.wait(
          project.id,
          item.id,
          startResult.id
        )

        if (cancelRequested.current) {
          setItems((prev) =>
            prev.map((it, idx) => (idx === i ? { ...it, status: 'cancelled' } : it))
          )
          setStatus('cancelled')
          break
        }

        if (outcome.state === 'COMPLETED') {
          setItems((prev) =>
            prev.map((it, idx) => (idx === i ? { ...it, status: 'completed' } : it))
          )
        } else if (outcome.state === 'CANCELLED') {
          setItems((prev) =>
            prev.map((it, idx) => (idx === i ? { ...it, status: 'cancelled' } : it))
          )
          setStatus('cancelled')
          break
        } else {
          setItems((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? { ...it, status: 'failed', error: outcome.error || 'Phân tích thất bại.' }
                : it
            )
          )
        }

        if (onStepComplete) {
          await onStepComplete()
        }
      } catch (runErr) {
        if (cancelRequested.current) {
          setStatus('cancelled')
          break
        }
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: 'failed',
                  error: runErr instanceof Error ? runErr.message : 'Lỗi khởi chạy phân tích.'
                }
              : it
          )
        )
      } finally {
        setActiveRunId(null)
        setActiveAssetId(null)
      }
    }

    isRunningRef.current = false
    if (!cancelRequested.current) {
      setStatus('completed')
    }
    if (onBatchFinished) {
      await onBatchFinished()
    }
  }

  const handleCancel = async () => {
    cancelRequested.current = true
    isRunningRef.current = false
    if (activeRunId && activeAssetId) {
      try {
        await window.api.sourceAnalysis.cancel(project.id, activeAssetId, activeRunId)
      } catch {
        // ignore
      }
    }
    setStatus('cancelled')
    setItems((prev) =>
      prev.map((it) => (it.status === 'analyzing' || it.status === 'probing' ? { ...it, status: 'cancelled' } : it))
    )
  }

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs ${
        isOpen ? 'flex' : 'hidden'
      } items-center justify-center p-4`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-modal-title"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${isRealignOnlyBatch ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'} flex items-center justify-center`}>
              {isRealignOnlyBatch ? (
                <Zap size={18} className="text-amber-500 fill-amber-500" />
              ) : (
                <Sparkles size={18} className="text-amber-500" />
              )}
            </div>
            <div>
              <h2 id="batch-modal-title" className="text-base font-bold text-slate-800">
                {isRealignOnlyBatch
                  ? `Cập nhật kịch bản (${items.length} video)`
                  : 'Đánh giá toàn bộ video SRC'}
              </h2>
              <p className="text-xs text-slate-500">
                {isRealignOnlyBatch
                  ? 'Tự động đối chiếu kịch bản mới từ JSON siêu tốc (~1s/clip, không cần tải lại video).'
                  : 'Tự động chấm điểm kỹ thuật & đối chiếu kịch bản lần lượt từng video bằng AI.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onMinimize || onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              title={status === 'running' ? 'Thu nhỏ và tiếp tục chạy ngầm' : 'Thu nhỏ'}
            >
              <Minimize2 size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Đóng"
              title={status === 'running' ? 'Đóng cửa sổ (phân tích vẫn tiếp tục chạy ngầm)' : 'Đóng'}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* AI Connection Warning */}
          {!aiReady && (
            <div role="alert" className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-semibold">Chưa kết nối AI Antigravity</p>
                <p className="text-[11px] text-amber-700 mt-0.5">{aiMessage}</p>
              </div>
            </div>
          )}

          {/* Configuration when idle */}
          {status === 'idle' && (
            <div className="space-y-4">
              {/* Scope Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-2">Phạm vi đánh giá</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setScope('unanalyzed')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      scope === 'unanalyzed'
                        ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-800">Chưa đánh giá / Cần cập nhật</span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold text-[10px]">
                        {unanalyzedVideos.length} video
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Chỉ đánh giá các clip chưa có điểm AI hoặc kịch bản vừa thay đổi. (Tiết kiệm thời gian)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      scope === 'all'
                        ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-800">Toàn bộ video</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                        {videoAssets.length} video
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Phân tích lại tất cả clip nguồn trong thư viện SRC từ đầu.
                    </p>
                  </button>
                </div>
              </div>

              {/* Model Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="batch-model" className="font-semibold text-slate-700">Model AI</label>
                  <span className="text-[11px] text-slate-500">Model mặc định từ cấu hình Kết nối AI</span>
                </div>
                <select
                  id="batch-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={!aiReady || !models.length}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
                >
                  {!models.length && <option value="">{aiReady ? 'Đang tải model...' : 'Chưa có model khả dụng'}</option>}
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m} {m.includes('2.5-flash') ? '★ Khuyên dùng (Nhanh & tối ưu)' : m.includes('flash') ? '(Tốc độ cao)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Script Status */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 mb-0.5">
                  <Film size={14} className="text-blue-600" />
                  <span>Kịch bản & Brief dự án</span>
                </div>
                {project.script ? (
                  <p className="text-[11px] text-slate-600 leading-normal">
                    ✨ Dự án <strong>đã có kịch bản phân cảnh</strong>. AI sẽ chấm điểm mức độ phù hợp phân cảnh (Script Fit) cho từng clip và đưa ra gợi ý dựng.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Dự án chưa có kịch bản phân cảnh. AI sẽ chấm điểm giá trị biên tập hình ảnh chung.
                  </p>
                )}
              </div>

              {/* Smart Re-align Notice when eligible clips exist */}
              {realignEligibleCount > 0 && (
                <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex items-start gap-2.5 text-blue-950 text-xs">
                    <Zap size={16} className="shrink-0 mt-0.5 text-amber-500 fill-amber-500" />
                    <div>
                      <span className="font-semibold text-blue-900">
                        ⚡ {realignEligibleCount} video chỉ đổi Kịch bản / Brief (Chế độ siêu tốc):
                      </span>
                      <p className="text-[11px] text-blue-800 mt-0.5 leading-normal">
                        Hệ thống sẽ <strong>đối chiếu siêu tốc từ JSON kết quả có sẵn</strong> (chỉ ~1–2 giây/clip, giữ nguyên toàn bộ điểm kỹ thuật, tiết kiệm 99% token và không cần upload lại video).
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 pl-6 pt-1 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceFullVideo}
                      onChange={(e) => setForceFullVideo(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-0"
                    />
                    <span>Buộc phân tích lại từ đầu toàn bộ file video (bỏ qua JSON)</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Running Progress Bar & Live Status */}
          {status !== 'idle' && (
            <div className="space-y-4">
              {/* Progress Summary Card */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    {status === 'running'
                      ? `Đang đánh giá clip ${currentIndex + 1} / ${items.length}`
                      : status === 'completed'
                      ? 'Đã hoàn tất đánh giá'
                      : `Đã dừng đánh giá (${completedCount} / ${items.length} video đã hoàn tất)`}
                  </span>
                  <span className="font-mono text-slate-500 font-bold">{progressPercent}%</span>
                </div>

                {/* Progress track */}
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      status === 'completed'
                        ? 'bg-emerald-500'
                        : status === 'cancelled'
                        ? 'bg-amber-500'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Counters */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                  <span className="text-emerald-700 font-semibold">✓ Đã xong: {completedCount}</span>
                  {failedCount > 0 && <span className="text-red-600 font-semibold">✕ Lỗi: {failedCount}</span>}
                  <span>Còn lại: {remainingCount}</span>
                </div>
              </div>

              {/* Status Hint when cancelled */}
              {status === 'cancelled' && remainingCount > 0 && (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center gap-2.5 text-amber-800 text-[11px]">
                  <AlertCircle size={15} className="shrink-0 text-amber-600" />
                  <span>
                    Tiến trình đánh giá đang tạm dừng. Bạn có thể bấm <strong>"Tiếp tục phân tích"</strong> bên dưới để hoàn tất <strong>{remainingCount} video còn lại</strong> mà không phải phân tích lại từ đầu.
                  </span>
                </div>
              )}

              {/* Current clip indicator */}
              {status === 'running' && currentItem && (
                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center gap-3 animate-pulse">
                  <Loader2 size={16} className="animate-spin text-blue-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-blue-900 truncate">{currentItem.filename}</p>
                      {currentItem.isRealign && (
                        <span className="shrink-0 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[9px] flex items-center gap-0.5">
                          <Zap size={9} className="text-amber-600 fill-amber-600" />
                          JSON Siêu tốc
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-blue-600 mt-0.5">
                      {currentItem.status === 'probing'
                        ? 'Đang đọc metadata & trích xuất video...'
                        : currentItem.isRealign
                        ? '⚡ Đang đối chiếu kịch bản từ JSON phân tích trước đó (siêu tốc ~1s)...'
                        : 'Đang gửi video tới Gemini AI để chấm điểm...'}
                    </p>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {items.map((it, idx) => (
                  <div
                    key={it.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-[11px] transition-colors ${
                      idx === currentIndex && status === 'running'
                        ? 'bg-blue-50/40 border-blue-300'
                        : it.status === 'completed'
                        ? 'bg-emerald-50/20 border-slate-200/80'
                        : it.status === 'failed'
                        ? 'bg-red-50/20 border-red-200'
                        : it.status === 'cancelled'
                        ? 'bg-amber-50/20 border-amber-200'
                        : 'bg-slate-50/40 border-slate-200/60 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {it.status === 'completed' ? (
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      ) : it.status === 'analyzing' || it.status === 'probing' ? (
                        <Loader2 size={14} className="animate-spin text-blue-600 shrink-0" />
                      ) : it.status === 'failed' ? (
                        <AlertCircle size={14} className="text-red-500 shrink-0" />
                      ) : (
                        <Clock size={14} className="text-slate-400 shrink-0" />
                      )}
                      <span className="font-medium text-slate-800 truncate" title={it.filename}>
                        {it.filename}
                      </span>
                      {it.isRealign && (
                        <span className="shrink-0 px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-semibold flex items-center gap-0.5" title="Đối chiếu kịch bản từ JSON siêu tốc">
                          <Zap size={9} className="text-amber-500 fill-amber-500" />
                          JSON (~1s)
                        </span>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      {it.status === 'completed' && (
                        <span className="text-emerald-700 font-semibold">
                          Hoàn tất
                        </span>
                      )}
                      {it.status === 'failed' && (
                        <span className="text-red-600 font-medium" title={it.error}>
                          Lỗi
                        </span>
                      )}
                      {it.status === 'cancelled' && (
                        <span className="text-amber-600 font-medium">
                          Tạm dừng
                        </span>
                      )}
                      {it.status === 'analyzing' && (
                        <span className="text-blue-600 font-semibold">
                          {it.isRealign ? 'Đang đọc JSON...' : 'Đang xử lý'}
                        </span>
                      )}
                      {it.status === 'probing' && (
                        <span className="text-slate-500">Đang đọc</span>
                      )}
                      {it.status === 'pending' && (
                        <span className="text-slate-400">Chờ</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <div>
            {status === 'running' ? (
              <button
                type="button"
                onClick={onMinimize || onClose}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline flex items-center gap-1.5"
                title="Đóng cửa sổ và tiếp tục phân tích trong nền"
              >
                <Minimize2 size={14} />
                <span>Thu nhỏ (chạy ngầm)</span>
              </button>
            ) : status !== 'idle' ? (
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-slate-500 hover:text-slate-700 font-medium hover:underline flex items-center gap-1.5"
                title="Quay lại màn hình lựa chọn ban đầu"
              >
                <RefreshCw size={13} />
                <span>Thiết lập lại từ đầu</span>
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2.5">
            {status === 'idle' ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors text-xs"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={!aiReady || !model || items.length === 0}
                  onClick={() => void runAnalysis(false)}
                  className={`px-5 h-9 ${
                    isRealignOnlyBatch
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  } disabled:opacity-50 text-white font-medium rounded-xl shadow-xs transition-colors flex items-center gap-1.5 text-xs`}
                >
                  {isRealignOnlyBatch ? <Zap size={14} className="fill-white" /> : <Play size={14} />}
                  <span>
                    {isRealignOnlyBatch
                      ? `Bắt đầu cập nhật kịch bản (${items.length} video)`
                      : `Bắt đầu đánh giá (${items.length} video)`}
                  </span>
                </button>
              </>
            ) : status === 'running' ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors text-xs flex items-center gap-1.5"
                  title="Đóng cửa sổ và để phân tích tiếp tục chạy ngầm"
                >
                  <Minimize2 size={13} />
                  <span>Chạy ngầm</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCancel()}
                  className="px-4 h-9 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold rounded-xl transition-colors flex items-center gap-1.5 text-xs"
                >
                  <StopCircle size={15} />
                  <span>Dừng lại</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors text-xs"
                >
                  Đóng
                </button>
                {remainingCount > 0 && (
                  <button
                    type="button"
                    disabled={!aiReady || !model}
                    onClick={() => void runAnalysis(true)}
                    className="px-5 h-9 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl shadow-xs transition-colors flex items-center gap-1.5 text-xs"
                  >
                    <Play size={14} />
                    <span>Tiếp tục phân tích ({remainingCount} video còn lại)</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
