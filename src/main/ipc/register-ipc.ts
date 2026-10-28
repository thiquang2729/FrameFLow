import { dialog, ipcMain, shell } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import { SOURCE_EXTENSIONS } from '@shared/media'
import {
  CreateCommentDTO,
  CreateProjectDTO,
  CreateRevisionPackageDTO,
  CreateVersionDTO,
  ImportSourceDTO,
  UpdateCommentStatusDTO,
  UpdateCommentDTO
} from '@shared/types'
import { ProjectService } from '../services/project.service'
import { VersionService } from '../services/version.service'
import { ReviewService } from '../services/review.service'
import { SourceService } from '../services/source.service'
import { ExportService } from '../services/export.service'
import { ScriptParserService } from '../services/script-parser.service'

export function registerIpcHandlers(
  projectService: ProjectService,
  versionService: VersionService,
  reviewService: ReviewService,
  sourceService: SourceService,
  exportService: ExportService,
  scriptParserService?: ScriptParserService
): void {
  const scriptParser = scriptParserService || new ScriptParserService()

  // --- Dialogs ---
  ipcMain.handle(IPC_CHANNELS.SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.SELECT_VIDEO_FILE, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.SELECT_MEDIA_FILES, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Media Files', extensions: SOURCE_EXTENSIONS },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle(IPC_CHANNELS.SELECT_SCRIPT_FILE, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Chọn tệp kịch bản',
      properties: ['openFile'],
      filters: [
        {
          name: 'Tệp kịch bản (PDF, DOCX, XLSX, TXT, JSON, CSV)',
          extensions: ['docx', 'xlsx', 'xls', 'pdf', 'txt', 'json', 'csv', 'md']
        },
        { name: 'Tất cả tệp', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePaths[0]) return null
    return scriptParser.parseFile(result.filePaths[0])
  })

  ipcMain.handle(IPC_CHANNELS.PARSE_SCRIPT_FILE, async (_, filePath: string) => {
    return scriptParser.parseFile(filePath)
  })

  // --- Project ---
  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    return projectService.getProjects()
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_GET, async (_, projectId: string) => {
    return projectService.getProject(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_, dto: CreateProjectDTO) => {
    return projectService.createProject(dto)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_UPDATE, async (_, { projectId, dto }: { projectId: string; dto: import('@shared/types').UpdateProjectDTO }) => {
    return projectService.updateProject(projectId, dto)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, async (_, projectId: string) => {
    return projectService.deleteProject(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_STATS, async (_, projectId: string) => {
    return projectService.getProjectStats(projectId)
  })

  // --- Version ---
  ipcMain.handle(IPC_CHANNELS.VERSION_LIST, async (_, projectId: string) => {
    return versionService.getVersions(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.VERSION_CREATE, async (_, dto: CreateVersionDTO) => {
    return versionService.createVersion(dto)
  })

  // --- Review Comments ---
  ipcMain.handle(
    IPC_CHANNELS.COMMENT_LIST,
    async (_, { projectId, versionId }: { projectId: string; versionId: string }) => {
      return reviewService.getComments(projectId, versionId)
    }
  )

  ipcMain.handle(IPC_CHANNELS.COMMENT_CREATE, async (_, dto: CreateCommentDTO) => {
    return reviewService.createComment(dto)
  })

  ipcMain.handle(IPC_CHANNELS.COMMENT_UPDATE, async (_, dto: UpdateCommentDTO) => reviewService.updateComment(dto))

  ipcMain.handle(
    IPC_CHANNELS.COMMENT_UPDATE_STATUS,
    async (_, dto: UpdateCommentStatusDTO & { projectId: string }) => {
      return reviewService.updateStatus(dto)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.COMMENT_DELETE,
    async (_, { projectId, commentId }: { projectId: string; commentId: string }) => {
      return reviewService.deleteComment(projectId, commentId)
    }
  )

  // --- Source ---
  ipcMain.handle(IPC_CHANNELS.SOURCE_LIST, async (_, projectId: string) => {
    return sourceService.getSources(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.SOURCE_IMPORT, async (_, dto: ImportSourceDTO) => {
    return sourceService.importSource(dto)
  })

  ipcMain.handle(IPC_CHANNELS.SOURCE_SCAN_DIRECTORY, async (_, directory: string) => {
    return sourceService.scanDirectory(directory)
  })

  // --- Package Export ---
  ipcMain.handle(IPC_CHANNELS.PACKAGE_PREVIEW, async (_, dto: CreateRevisionPackageDTO) => {
    return exportService.previewPackage(dto)
  })
  ipcMain.handle(IPC_CHANNELS.PACKAGE_CREATE, async (_, dto: CreateRevisionPackageDTO) => {
    return exportService.createPackage(dto)
  })

  ipcMain.handle(IPC_CHANNELS.PACKAGE_OPEN_FOLDER, async (_, folderPath: string) => {
    const error = await shell.openPath(folderPath)
    if (error) throw new Error(error)
    return true
  })
}
