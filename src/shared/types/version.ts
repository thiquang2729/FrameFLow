export type VersionCreator = 'USER' | 'AGENT'

export interface EditVersion {
  id: string
  projectId: string
  versionNumber: number
  name: string // e.g. 'Draft V1', 'Draft V2'
  videoPath: string // Absolute path to the draft video file
  duration?: number
  fps?: number
  width?: number
  height?: number
  parentVersionId?: string | null
  createdBy: VersionCreator
  createdAt: string
}

export interface CreateVersionDTO {
  projectId: string
  versionNumber: number
  name: string
  videoPath: string
  parentVersionId?: string | null
  createdBy?: VersionCreator
  duration?: number
  fps?: number
  width?: number
  height?: number
}
