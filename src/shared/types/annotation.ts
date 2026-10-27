export type AnnotationType = 'ARROW' | 'RECT' | 'CIRCLE' | 'TEXT'

export interface Point {
  x: number // Normalized percentage (0.0 to 1.0)
  y: number // Normalized percentage (0.0 to 1.0)
}

export interface AnnotationData {
  type: AnnotationType
  color: string
  strokeWidth: number
  // Arrow or Line points
  points?: number[] // [startX, startY, endX, endY] in normalized coordinates
  // Rect or Circle bounds
  x?: number
  y?: number
  width?: number
  height?: number
  // Text content
  text?: string
  fontSize?: number
}

export interface Annotation {
  id: string
  reviewCommentId: string
  type: AnnotationType
  data: AnnotationData
  createdAt: string
}
