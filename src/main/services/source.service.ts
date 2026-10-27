import fs from 'fs'
import path from 'path'
import { ulid } from 'ulid'
import { ImportSourceDTO, SourceAsset } from '@shared/types'
import { ProjectService } from './project.service'

export class SourceService {
  constructor(private projectService: ProjectService) {}

  public async getSources(projectId: string): Promise<SourceAsset[]> {
    const db = await this.projectService.getDb(projectId)
    const rows = db.query<any>(
      `SELECT id, project_id, original_path, proxy_path, filename, duration, width, height, fps, codec, file_size, file_hash, imported_at
       FROM source_assets
       WHERE project_id = ?
       ORDER BY imported_at DESC`,
      [projectId]
    )

    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      originalPath: r.original_path,
      proxyPath: r.proxy_path,
      filename: r.filename,
      duration: r.duration,
      width: r.width,
      height: r.height,
      fps: r.fps,
      codec: r.codec,
      fileSize: r.file_size,
      fileHash: r.file_hash,
      importedAt: r.imported_at
    }))
  }

  public async importSource(dto: ImportSourceDTO): Promise<SourceAsset> {
    const db = await this.projectService.getDb(dto.projectId)
    const id = ulid()
    const now = new Date().toISOString()

    let fileSize = dto.fileSize || 0
    if (!fileSize && fs.existsSync(dto.filePath)) {
      const stats = fs.statSync(dto.filePath)
      fileSize = stats.size
    }

    const asset: SourceAsset = {
      id,
      projectId: dto.projectId,
      originalPath: dto.filePath,
      filename: dto.filename || path.basename(dto.filePath),
      duration: dto.duration || 0,
      width: dto.width || 1920,
      height: dto.height || 1080,
      fps: dto.fps || 30,
      codec: dto.codec || 'h264',
      fileSize,
      fileHash: dto.fileHash || '',
      importedAt: now
    }

    db.run(
      `INSERT INTO source_assets (id, project_id, original_path, filename, duration, width, height, fps, codec, file_size, file_hash, imported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        asset.id,
        asset.projectId,
        asset.originalPath,
        asset.filename,
        asset.duration,
        asset.width,
        asset.height,
        asset.fps,
        asset.codec,
        asset.fileSize,
        asset.fileHash,
        asset.importedAt
      ]
    )

    return asset
  }
}
