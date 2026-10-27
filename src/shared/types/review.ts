import { Annotation } from './annotation'

export type CommentCategory =
  | 'SUBTITLE'
  | 'PACING'
  | 'AUDIO'
  | 'COLOR'
  | 'CUT'
  | 'EFFECT'
  | 'GRAPHICS'
  | 'GENERAL'

export type CommentPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type CommentStatus = 'OPEN' | 'IN_PROGRESS' | 'FIXED' | 'PARTIAL' | 'REJECTED'

export type AttachmentType = 'FRAME' | 'ANNOTATED_FRAME' | 'REFERENCE'

export interface ReviewAttachment {
  id: string
  reviewCommentId: string
  type: AttachmentType
  filePath: string // Relative path or absolute path
  width?: number
  height?: number
  createdAt: string
}

export interface ReviewComment {
  id: string // e.g. R001, R002 or ULID
  projectId: string
  editVersionId: string
  timestamp: number // In seconds, e.g. 17.420
  frameNumber?: number
  category: CommentCategory
  priority: CommentPriority
  content: string
  status: CommentStatus
  createdBy: string
  createdAt: string
  resolvedAt?: string | null

  // Aggregated data
  attachments?: ReviewAttachment[]
  annotations?: Annotation[]
}

export interface CreateCommentDTO {
  projectId: string
  editVersionId: string
  timestamp: number
  frameNumber?: number
  category: CommentCategory
  priority: CommentPriority
  content: string
  frameBase64?: string // Captured frame from video player
  annotations?: Annotation[]
  annotatedFrameBase64?: string
}

export interface UpdateCommentStatusDTO {
  commentId: string
  status: CommentStatus
}
