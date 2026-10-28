import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import type { AiStatus, AiTestResult } from '../shared/types/ai'
import type { AnalysisReview, SourceAnalysisEnvironment, SourceAnalysisOverview, SourceAnalysisRequest, SourceAnalysisRun, SourceMediaInfo } from '../shared/types/source-analysis'
import {
  CreateCommentDTO,
  CreateProjectDTO,
  UpdateProjectDTO,
  CreateRevisionPackageDTO,
  CreateVersionDTO,
  ImportSourceDTO,
  UpdateCommentStatusDTO,
  UpdateCommentDTO
} from '../shared/types'

const api = {
  sourceAnalysis: {
    environment: (): Promise<SourceAnalysisEnvironment> => ipcRenderer.invoke('source-analysis:environment'),
    overview: (projectId: string): Promise<SourceAnalysisOverview[]> => ipcRenderer.invoke('source-analysis:overview', projectId),
    remove: (projectId: string, sourceId: string): Promise<void> => ipcRenderer.invoke('source-analysis:remove', projectId, sourceId),
    removeMany: (projectId: string, sourceIds: string[]): Promise<number> => ipcRenderer.invoke('source-analysis:remove-many', projectId, sourceIds),
    probe: (projectId: string, sourceId: string): Promise<SourceMediaInfo> => ipcRenderer.invoke('source-analysis:probe', projectId, sourceId),
    relink: (projectId: string, sourceId: string): Promise<boolean> => ipcRenderer.invoke('source-analysis:relink', projectId, sourceId),
    list: (projectId: string, sourceId: string): Promise<SourceAnalysisRun[]> => ipcRenderer.invoke('source-analysis:list', projectId, sourceId),
    start: (request: SourceAnalysisRequest): Promise<{ id: string }> => ipcRenderer.invoke('source-analysis:start', request),
    wait: (projectId: string, sourceId: string, runId: string): Promise<{ state: AnalysisState; error?: string }> =>
      ipcRenderer.invoke('source-analysis:wait', projectId, sourceId, runId),
    cancel: (projectId: string, sourceId: string, runId: string): Promise<void> => ipcRenderer.invoke('source-analysis:cancel', projectId, sourceId, runId),
    review: (projectId: string, sourceId: string, runId: string, review: AnalysisReview, note: string, tags: string[]): Promise<void> => ipcRenderer.invoke('source-analysis:review', projectId, sourceId, runId, review, note, tags)
  },
  ai: {
    status: (): Promise<AiStatus> => ipcRenderer.invoke('ai:status'),
    restart: (): Promise<AiStatus> => ipcRenderer.invoke('ai:restart'),
    login: (): Promise<AiStatus> => ipcRenderer.invoke('ai:login'),
    cancelLogin: (): Promise<void> => ipcRenderer.invoke('ai:cancel-login'),
    models: (): Promise<string[]> => ipcRenderer.invoke('ai:models'),
    videoModels: (): Promise<string[]> => ipcRenderer.invoke('ai:video-models'),
    selectModel: (model: string): Promise<void> => ipcRenderer.invoke('ai:select-model', model),
    selectSrcModel: (model: string): Promise<void> => ipcRenderer.invoke('ai:select-src-model', model),
    test: (model: string, prompt: string): Promise<AiTestResult> => ipcRenderer.invoke('ai:test', model, prompt),
    cancelTest: (): Promise<void> => ipcRenderer.invoke('ai:cancel-test')
  },
  // Dialogs
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY),
  selectVideoFile: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_VIDEO_FILE),
  selectMediaFiles: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_MEDIA_FILES),
  selectScriptFile: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_SCRIPT_FILE),
  parseScriptFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.PARSE_SCRIPT_FILE, filePath),

  // Projects
  listProjects: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),
  getProject: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET, projectId),
  createProject: (dto: CreateProjectDTO) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, dto),
  updateProject: (projectId: string, dto: UpdateProjectDTO) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_UPDATE, { projectId, dto }),
  deleteProject: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, projectId),
  getProjectStats: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_STATS, projectId),

  // Versions
  listVersions: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.VERSION_LIST, projectId),
  createVersion: (dto: CreateVersionDTO) => ipcRenderer.invoke(IPC_CHANNELS.VERSION_CREATE, dto),

  // Comments
  listComments: (projectId: string, versionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMENT_LIST, { projectId, versionId }),
  createComment: (dto: CreateCommentDTO) => ipcRenderer.invoke(IPC_CHANNELS.COMMENT_CREATE, dto),
  updateComment: (dto: UpdateCommentDTO) => ipcRenderer.invoke(IPC_CHANNELS.COMMENT_UPDATE, dto),
  updateCommentStatus: (dto: UpdateCommentStatusDTO & { projectId: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMENT_UPDATE_STATUS, dto),
  deleteComment: (projectId: string, commentId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMENT_DELETE, { projectId, commentId }),

  // Source assets
  listSources: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.SOURCE_LIST, projectId),
  importSource: (dto: ImportSourceDTO) => ipcRenderer.invoke(IPC_CHANNELS.SOURCE_IMPORT, dto),
  scanSourceDirectory: (directory: string) => ipcRenderer.invoke(IPC_CHANNELS.SOURCE_SCAN_DIRECTORY, directory),

  // Packages
  previewPackage: (dto: CreateRevisionPackageDTO) =>
    ipcRenderer.invoke(IPC_CHANNELS.PACKAGE_PREVIEW, dto),
  createPackage: (dto: CreateRevisionPackageDTO) =>
    ipcRenderer.invoke(IPC_CHANNELS.PACKAGE_CREATE, dto),
  openPackageFolder: (folderPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PACKAGE_OPEN_FOLDER, folderPath)
}

contextBridge.exposeInMainWorld('api', api)

export type FrameFlowAPI = typeof api
