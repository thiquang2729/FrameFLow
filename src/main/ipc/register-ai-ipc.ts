import { ipcMain } from 'electron'
import type { AiService } from '../services/ai.service'

export function registerAiIpc(service: AiService): void {
  const handle = (channel: string, action: (...args: any[]) => unknown) => {
    ipcMain.handle(channel, (event, ...args) => {
      const frame = event.senderFrame
      const url = frame?.url || ''
      const devUrl = process.env.ELECTRON_RENDERER_URL
      if (!frame || frame !== event.sender.mainFrame || !(url.startsWith('file://') || (devUrl && new URL(url).origin === new URL(devUrl).origin))) {
        throw new Error('Không được phép truy cập kết nối AI.')
      }
      return action(...args)
    })
  }
  handle('ai:status', () => service.getStatus())
  handle('ai:restart', () => service.restart())
  handle('ai:login', () => service.login())
  handle('ai:cancel-login', () => service.cancelLogin())
  handle('ai:models', () => service.listModels())
  handle('ai:select-model', (model: string) => service.selectModel(model))
  handle('ai:test', (model: string, prompt: string) => service.testPrompt(model, prompt))
  handle('ai:cancel-test', () => service.cancelTest())
}
