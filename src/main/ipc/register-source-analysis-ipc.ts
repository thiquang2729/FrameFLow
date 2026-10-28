import { dialog, ipcMain } from 'electron'
import type { SourceAnalysisService } from '../services/source-analysis.service'
import type { AnalysisReview, SourceAnalysisRequest } from '../../shared/types/source-analysis'

export function registerSourceAnalysisIpc(service: SourceAnalysisService): void {
  const handle = (name: string, action: (...args: any[]) => unknown) => {
    ipcMain.handle(name, (event, ...args) => {
      const frame = event.senderFrame
      const url = frame?.url || ''
      const dev = process.env.ELECTRON_RENDERER_URL
      if (!frame || frame !== event.sender.mainFrame || !(url.startsWith('file://') || (dev && new URL(url).origin === new URL(dev).origin))) throw new Error('Không được phép truy cập phân tích SRC.')
      return action(...args)
    })
  }
  handle('source-analysis:environment', () => service.environment())
  handle('source-analysis:overview', (projectId: string) => service.overview(projectId))
  handle('source-analysis:remove', (projectId: string, sourceId: string) => service.remove(projectId, sourceId))
  handle('source-analysis:remove-many', (projectId: string, sourceIds: string[]) => service.removeMany(projectId, sourceIds))
  handle('source-analysis:probe', (projectId: string, sourceId: string) => service.probe(projectId, sourceId))
  handle('source-analysis:relink', async (projectId: string, sourceId: string) => {
    await service.list(projectId, sourceId)
    const selected = await dialog.showOpenDialog({ title: 'Liên kết lại SRC', properties: ['openFile'], filters: [{ name: 'Video / ảnh', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', 'jpg', 'jpeg', 'png'] }] })
    if (selected.canceled || !selected.filePaths[0]) return false
    await service.relink(projectId, sourceId, selected.filePaths[0])
    return true
  })
  handle('source-analysis:list', (projectId: string, sourceId: string) => service.list(projectId, sourceId))
  handle('source-analysis:start', (request: SourceAnalysisRequest) => service.start(request))
  handle('source-analysis:cancel', (projectId: string, sourceId: string, runId: string) => service.cancel(projectId, sourceId, runId))
  handle('source-analysis:review', (projectId: string, sourceId: string, runId: string, review: AnalysisReview, note: string, tags: string[]) => service.review(projectId, sourceId, runId, review, note, tags))
}
