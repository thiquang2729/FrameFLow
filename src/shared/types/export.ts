export interface RevisionPackageReviewItem {
  id: string
  timestamp: number
  frame?: number
  category: string
  priority: string
  comment: string
  frameImage?: string // e.g. "frames/R021.jpg"
  annotationImage?: string // e.g. "annotated/R021.png"
}

export interface RevisionPackageJson {
  projectName: string
  sourceVersion: string
  targetVersion: string
  exportedAt: string
  instructions?: string
  reviews: RevisionPackageReviewItem[]
}

export interface RevisionPackage {
  id: string
  projectId: string
  sourceVersionId: string
  packagePath: string
  instructions?: string
  createdAt: string
}

export interface CreateRevisionPackageDTO {
  projectId: string
  sourceVersionId: string
  targetVersionName: string // e.g. "Draft V3"
  commentIds: string[]
  instructions?: string
}
