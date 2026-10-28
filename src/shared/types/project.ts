export type ProjectStatus = 'PLANNING' | 'INGESTING' | 'EDITING' | 'REVIEW' | 'FINAL'

export interface Project {
  id: string
  name: string
  description?: string
  script?: string
  targetPlatform?: string
  targetDuration?: number // seconds
  aspectRatio?: string // e.g., '16:9', '9:16'
  status: ProjectStatus
  projectPath: string // Absolute path to project directory
  createdAt: string
  updatedAt: string
}

export interface CreateProjectDTO {
  name: string
  description?: string
  script?: string
  targetPlatform?: string
  targetDuration?: number
  aspectRatio?: string
  projectDir?: string // Custom directory or default ~/FrameFlowProjects
}

export interface UpdateProjectDTO {
  name?: string
  description?: string
  script?: string
  targetPlatform?: string
  targetDuration?: number
  aspectRatio?: string
  status?: ProjectStatus
}

export interface ProjectStats {
  sourceCount: number
  versionCount: number
  openReviewCount: number
  highPriorityCount: number
}
