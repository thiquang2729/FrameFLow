import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import {
  CreateCommentDTO,
  CreateProjectDTO,
  CreateRevisionPackageDTO,
  CreateVersionDTO,
  ImportSourceDTO,
  UpdateCommentStatusDTO,
  UpdateCommentDTO
} from '../shared/types'

const api = {
  // Dialogs
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY),
  selectVideoFile: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_VIDEO_FILE),
  selectMediaFiles: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_MEDIA_FILES),

  // Projects
  listProjects: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),
  getProject: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET, projectId),
  createProject: (dto: CreateProjectDTO) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, dto),
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
