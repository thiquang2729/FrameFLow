export interface SourceAsset {
  id: string
  projectId: string
  originalPath: string
  proxyPath?: string | null
  thumbnailPath?: string | null
  filename: string
  duration?: number
  width?: number
  height?: number
  fps?: number
  codec?: string
  fileSize?: number
  fileHash?: string
  importedAt: string
}

export interface ImportSourceDTO {
  projectId: string
  filePath: string
  filename: string
  duration?: number
  width?: number
  height?: number
  fps?: number
  codec?: string
  fileSize?: number
  fileHash?: string
  thumbnailBase64?: string
}
