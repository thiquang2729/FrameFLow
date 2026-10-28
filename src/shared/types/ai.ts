export interface AiStatus {
  state: 'stopped' | 'starting' | 'ready' | 'error'
  message: string
  version: string
  endpoint: string | null
  pid: number | null
  accounts: number
  login: 'idle' | 'waiting' | 'success' | 'error'
  loginMessage: string
  selectedModel: string
  srcModel?: string
}

export interface AiTestResult {
  model: string
  text: string
  durationMs: number
}
