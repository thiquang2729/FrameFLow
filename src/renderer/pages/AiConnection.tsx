import React, { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, Film, RefreshCw, Send, Square } from 'lucide-react'
import type { AiStatus, AiTestResult } from '../../shared/types/ai'
import './ai-connection.css'

export function AiConnection(): React.JSX.Element {
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState('')
  const [videoModels, setVideoModels] = useState<string[]>([])
  const [srcModel, setSrcModel] = useState('')
  const [srcNotice, setSrcNotice] = useState('')
  const [prompt, setPrompt] = useState('Xin chào! Hãy trả lời ngắn gọn bằng tiếng Việt để xác nhận kết nối AI đang hoạt động.')
  const [result, setResult] = useState<AiTestResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [sending, setSending] = useState(false)
  const mounted = useRef(true)
  const loadingModels = useRef(false)
  const loadingVideoModels = useRef(false)
  const previousAccounts = useRef(-1)

  const loadModels = async (selected?: string) => {
    if (loadingModels.current) return
    loadingModels.current = true
    try {
      const list = await window.api.ai.models()
      if (!mounted.current) return
      setModels(list)
      setModel((current) => list.includes(current) ? current : selected && list.includes(selected) ? selected : list[0] || '')
    } finally { loadingModels.current = false }
  }

  const loadVideoModels = async (selected?: string) => {
    if (loadingVideoModels.current) return
    loadingVideoModels.current = true
    try {
      const list = await window.api.ai.videoModels()
      if (!mounted.current) return
      setVideoModels(list)
      const current = selected || srcModel
      const chosen = current && list.includes(current)
        ? current
        : list.find((m) => m.includes('2.5-flash')) || list.find((m) => m.includes('flash')) || list[0] || ''
      setSrcModel(chosen)
      if (chosen && (!selected || chosen !== selected)) {
        void window.api.ai.selectSrcModel(chosen).catch(() => {})
      }
    } finally { loadingVideoModels.current = false }
  }

  useEffect(() => {
    mounted.current = true
    let active = true
    const refresh = async () => {
      try {
        const next = await window.api.ai.status()
        if (!active) return
        setStatus(next)
        if (next.srcModel && !srcModel) {
          setSrcModel(next.srcModel)
        }
        if (next.state === 'ready' && next.accounts !== previousAccounts.current) {
          await Promise.all([
            loadModels(next.selectedModel),
            loadVideoModels(next.srcModel)
          ])
          previousAccounts.current = next.accounts
        }
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'Không đọc được trạng thái AI.') }
    }
    void refresh()
    const timer = setInterval(() => { void refresh() }, 2000)
    return () => { active = false; mounted.current = false; clearInterval(timer) }
  }, [srcModel])

  const action = async (name: string, run: () => Promise<unknown>) => {
    setBusy(name)
    setError('')
    try {
      await run()
      setStatus(await window.api.ai.status())
    } catch (err) { setError(err instanceof Error ? err.message : 'Thao tác AI thất bại.') }
    finally { setBusy('') }
  }

  const handleSelectSrcModel = async (newModel: string) => {
    setSrcModel(newModel)
    setError('')
    try {
      await window.api.ai.selectSrcModel(newModel)
      setSrcNotice(`Đã lưu "${newModel}" làm model mặc định cho duyệt SRC.`)
      setTimeout(() => {
        if (mounted.current) setSrcNotice('')
      }, 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được model duyệt SRC.')
    }
  }

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setResult(null)
    setSending(true)
    try {
      await window.api.ai.selectModel(model)
      setResult(await window.api.ai.test(model, prompt))
    } catch (err) { setError(err instanceof Error ? err.message : 'Không nhận được phản hồi AI.') }
    finally { setSending(false) }
  }
  const ready = status?.state === 'ready'
  const waiting = status?.login === 'waiting'
  const hasAccount = Boolean(status?.accounts)
  const stateLabel = ready ? 'Đang chạy' : status?.state === 'error' ? 'Mất kết nối' : status?.state === 'stopped' ? 'Đã dừng' : 'Đang khởi động'

  return (
    <section className="ai-workbench" aria-labelledby="ai-heading">
      <div className="ai-workbench__inner">
        <header className="ai-page-header">
          <div>
            <h1 id="ai-heading">Kết nối AI</h1>
          </div>
          <span className="ai-version">CLIProxyAPI / {status?.version || '8.0.45'}</span>
        </header>

        <div className="ai-runtime" data-state={status?.state || 'starting'}>
          <div className="ai-runtime__identity">
            <span className="ai-status-dot" aria-hidden="true" />
            <strong>Proxy cục bộ</strong>
            <span className="ai-runtime__state" role="status">{stateLabel}</span>
          </div>
          <code className="ai-runtime__endpoint">{status?.endpoint || 'Đang chờ địa chỉ kết nối'}</code>
          <button type="button" className="ai-button ai-button--quiet" disabled={Boolean(busy) || sending || waiting || status?.state === 'starting'} onClick={() => void action('restart', async () => { setModels([]); previousAccounts.current = -1; await window.api.ai.restart() })}>
            <RefreshCw size={14} aria-hidden="true" />{busy === 'restart' ? 'Đang khởi động...' : 'Khởi động lại AI'}
          </button>
        </div>
        {status?.state === 'error' && <p className="ai-notice ai-notice--error" role="alert">{status.message}</p>}

        <div className="ai-console">
          <aside className="ai-account" aria-labelledby="ai-account-heading">
            <h2 id="ai-account-heading" className="ai-section-heading">Tài khoản</h2>
            <div className="ai-provider">
              <h3>Antigravity</h3>
            </div>
            <div className="ai-account-state">
              <span className="ai-account-state__mark" data-connected={hasAccount} aria-hidden="true">{hasAccount ? '●' : '○'}</span>
              <span>{hasAccount ? `${status?.accounts} tài khoản đã lưu` : 'Chưa đăng nhập'}</span>
            </div>
            {waiting ? (
              <button type="button" className="ai-button ai-button--outline ai-button--full" disabled={Boolean(busy)} onClick={() => void action('cancel-login', () => window.api.ai.cancelLogin())}><Square size={13} aria-hidden="true" />Hủy đăng nhập</button>
            ) : (
              <button type="button" className="ai-button ai-button--primary ai-button--full" disabled={!ready || Boolean(busy) || sending} onClick={() => void action('login', () => window.api.ai.login())}>{busy === 'login' ? 'Đang mở trình duyệt...' : 'Đăng nhập Antigravity'}<ArrowUpRight size={16} aria-hidden="true" /></button>
            )}
            {status?.loginMessage && <p className={`ai-login-note${status.login === 'error' ? ' ai-login-note--error' : ''}`} role="status">{status.loginMessage}</p>}

            <dl className="ai-connection-details">
              <div><dt>Kết nối</dt><dd>Qua CLIProxyAPI</dd></div>
              <div><dt>Khởi động</dt><dd>Cùng FrameFlow</dd></div>
              <div><dt>Model khả dụng</dt><dd>{models.length || 'Chưa tải'}</dd></div>
              <div><dt>Model duyệt SRC</dt><dd style={{ color: '#1d4ed8', fontWeight: 600 }}>{srcModel || 'Chưa chọn'}</dd></div>
            </dl>
          </aside>

          <div className="ai-playground">
            {/* Section 1: SRC Video Intelligence Model Configuration */}
            <section className="ai-src-config" aria-labelledby="ai-src-heading">
              <div className="ai-src-config__heading">
                <div className="ai-src-config__title-group">
                  <Film size={17} />
                  <h2 id="ai-src-heading" className="ai-section-heading">Model duyệt tư liệu SRC</h2>
                  <span className="ai-src-config__badge">Video Intelligence</span>
                </div>
                <button
                  type="button"
                  className="ai-button ai-button--text"
                  disabled={!ready || Boolean(busy) || waiting}
                  onClick={() => void action('video-models', () => loadVideoModels(srcModel))}
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  {busy === 'video-models' ? 'Đang tải...' : 'Làm mới model SRC'}
                </button>
              </div>
              <p className="ai-src-config__desc">
                Chọn model Gemini mặc định được sử dụng để phân tích hình ảnh, chấm điểm kỹ thuật và đối chiếu kịch bản khi duyệt clip trong Thư viện SRC.
              </p>

              <div className="ai-field">
                <div className="ai-field__label-row">
                  <label htmlFor="ai-src-model">Model mặc định cho duyệt SRC</label>
                  {srcModel && <span className="ai-character-count">Hiện tại: {srcModel}</span>}
                </div>
                <div className="ai-src-model-selector">
                  <select
                    id="ai-src-model"
                    value={srcModel}
                    onChange={(event) => void handleSelectSrcModel(event.target.value)}
                    disabled={!ready || Boolean(busy) || !videoModels.length}
                  >
                    {!videoModels.length && <option value="">{ready ? 'Đang tải danh sách model video...' : 'Chưa có model khả dụng'}</option>}
                    {videoModels.map((id) => (
                      <option key={id} value={id}>
                        {id} {id.includes('2.5-flash') ? '★ Khuyên dùng (Nhanh & tối ưu)' : id.includes('flash') ? '(Tốc độ cao)' : id.includes('pro') ? '(Phân tích sâu)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {srcNotice && (
                  <p className="ai-src-notice-saved" role="status">
                    <Check size={14} aria-hidden="true" />
                    <span>{srcNotice}</span>
                  </p>
                )}
                <p className="ai-src-hint">
                  💡 Model này sẽ được tự động chọn sẵn mỗi khi bạn mở phân tích clip trong Thư viện SRC. Bạn vẫn có thể linh hoạt đổi model ngay tại cửa sổ từng clip nếu muốn thử nghiệm.
                </p>
              </div>
            </section>

            {/* Section 2: Connection Test Playground */}
            <form onSubmit={(event) => void send(event)} aria-busy={sending}>
              <div className="ai-playground__heading">
                <h2 className="ai-section-heading">Thử nghiệm kết nối (Playground)</h2>
                <p className="ai-playground__desc">Gửi câu hỏi văn bản mẫu để kiểm tra kết nối với proxy và Antigravity.</p>
              </div>

              <div className="ai-field">
                <div className="ai-field__label-row">
                  <label htmlFor="ai-model">Model thử nghiệm</label>
                  <button type="button" className="ai-button ai-button--text" disabled={!ready || Boolean(busy) || sending || waiting} onClick={() => void action('models', () => loadModels(status?.selectedModel))}><RefreshCw size={13} aria-hidden="true" />{busy === 'models' ? 'Đang tải...' : 'Tải model'}</button>
                </div>
                <select id="ai-model" value={model} onChange={(event) => { setModel(event.target.value); setResult(null) }} disabled={!ready || sending || Boolean(busy) || !models.length}>
                  {!models.length && <option value="">Chưa có model khả dụng</option>}
                  {models.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
              </div>

              <div className="ai-field">
                <div className="ai-field__label-row"><label htmlFor="ai-prompt">Câu hỏi thử</label><span className="ai-character-count">{prompt.length.toLocaleString('vi-VN')} / 8.000</span></div>
                <textarea id="ai-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={8000} rows={4} disabled={sending} />
              </div>

              <div className="ai-send-row">
                <p>Tối đa 90 giây.<br />Sử dụng hạn mức của tài khoản.</p>
                {sending ? (
                  <button type="button" className="ai-button ai-button--outline" onClick={() => void window.api.ai.cancelTest().catch((err) => setError(String(err)))}><Square size={13} aria-hidden="true" />Hủy yêu cầu</button>
                ) : (
                  <button type="submit" className="ai-button ai-button--primary" disabled={!ready || !model || !prompt.trim() || !hasAccount || Boolean(busy) || waiting}>Gửi kiểm tra<Send size={14} aria-hidden="true" /></button>
                )}
              </div>
              {error && <p role="alert" className="ai-notice ai-notice--error">{error}</p>}

              <section className="ai-response" aria-labelledby="ai-response-heading" aria-live="polite" aria-atomic="true">
                <div className="ai-response__header">
                  <h3 id="ai-response-heading">Phản hồi</h3>
                  <span className={result ? 'ai-response__success' : ''}>{sending ? 'Đang chờ model' : result ? `${(result.durationMs / 1000).toFixed(1)} giây` : 'Chưa gửi yêu cầu'}</span>
                </div>
                {result ? (
                  <div className="ai-response__body"><p className="ai-response__model">{result.model}</p><p className="ai-response__text">{result.text}</p></div>
                ) : (
                  <div className="ai-response__empty"><span className="ai-response__cursor" aria-hidden="true" /><div><p>{sending ? 'Đang kết nối tới model...' : 'Phản hồi sẽ xuất hiện ở đây.'}</p><span>{sending ? 'Bạn có thể hủy yêu cầu nếu không muốn chờ.' : 'Chưa có nội dung nào được gửi đến AI.'}</span></div></div>
                )}
              </section>
            </form>
          </div>
        </div>

      </div>
    </section>
  )
}
