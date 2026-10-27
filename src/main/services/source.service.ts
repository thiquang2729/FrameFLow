import fs from 'fs'
import path from 'path'
import { ulid } from 'ulid'
import { ImportSourceDTO, SourceAsset } from '@shared/types'
import { SOURCE_EXTENSIONS } from '@shared/media'
import { ProjectService } from './project.service'

const supported = (filePath: string): boolean => SOURCE_EXTENSIONS.includes(path.extname(filePath).slice(1).toLowerCase())
const pathKey = (filePath: string): string => process.platform === 'win32' ? filePath.toLowerCase() : filePath

export class SourceService {
  constructor(private projectService: ProjectService) {}

  public async scanDirectory(directory: string): Promise<string[]> {
    if (!path.isAbsolute(directory)) throw new Error('An absolute directory path is required')
    const pending = [directory]
    const files: string[] = []
    let visited = 0
    while (pending.length) {
      const current = pending.pop()!
      // Do not traverse symlinks/junctions: avoid cycles and leaving the selected tree.
      if ((await fs.promises.lstat(current)).isSymbolicLink()) continue
      const entries = await fs.promises.readdir(current, { withFileTypes: true })
      for (const entry of entries) {
        if (++visited > 10000) throw new Error('Thư mục quá lớn. Hãy chọn thư mục con (tối đa 10.000 mục).')
        const entryPath = path.join(current, entry.name)
        if (entry.isDirectory()) pending.push(entryPath)
        else if (entry.isFile() && supported(entryPath)) files.push(entryPath)
      }
    }
    return files.sort((a, b) => a.localeCompare(b))
  }

  public async getSources(projectId: string): Promise<SourceAsset[]> {
    const db = await this.projectService.getDb(projectId)
    return db.query<Record<string, any>>(
      'SELECT * FROM source_assets WHERE project_id = ? ORDER BY imported_at DESC, id DESC', [projectId]
    ).map((row) => ({
      id: row.id, projectId: row.project_id, originalPath: row.original_path,
      proxyPath: row.proxy_path, thumbnailPath: row.thumbnail_path, filename: row.filename,
      duration: row.duration ?? undefined, width: row.width ?? undefined, height: row.height ?? undefined,
      fps: row.fps ?? undefined, codec: row.codec ?? undefined, fileSize: row.file_size,
      fileHash: row.file_hash, importedAt: row.imported_at
    }))
  }

  public async importSource(dto: ImportSourceDTO): Promise<SourceAsset> {
    if (!path.isAbsolute(dto.filePath) || !supported(dto.filePath)) throw new Error('Unsupported source file path')
    const project = await this.projectService.getProject(dto.projectId)
    if (!project) throw new Error('Project not found')
    const filePath = await fs.promises.realpath(dto.filePath)
    const stats = await fs.promises.stat(filePath)
    if (!stats.isFile() || !supported(filePath)) throw new Error('Source must be a supported media file')

    for (const key of ['duration', 'width', 'height', 'fps'] as const) {
      const value = dto[key]
      if (value !== undefined && (!Number.isFinite(value) || value <= 0 ||
        ((key === 'width' || key === 'height') && !Number.isInteger(value)))) throw new Error(`Invalid source ${key}`)
    }
    if (dto.codec !== undefined && (typeof dto.codec !== 'string' || dto.codec.length > 100)) throw new Error('Invalid source codec')

    const db = await this.projectService.getDb(dto.projectId)
    const existing = db.query<{ id: string; original_path: string }>(
      'SELECT id, original_path FROM source_assets WHERE project_id = ?', [dto.projectId]
    ).find((asset) => pathKey(asset.original_path) === pathKey(filePath))
    if (existing) return (await this.getSources(dto.projectId)).find((asset) => asset.id === existing.id)!

    const asset: SourceAsset = {
      id: ulid(), projectId: dto.projectId, originalPath: filePath, filename: path.basename(filePath),
      duration: dto.duration, width: dto.width, height: dto.height, fps: dto.fps, codec: dto.codec?.trim() || undefined,
      fileSize: stats.size, importedAt: new Date().toISOString()
    }
    let thumbnailFile: string | undefined
    try {
      return db.transaction(() => {
        if (dto.thumbnailBase64) {
          const match = dto.thumbnailBase64.length <= 4 * 1024 * 1024 && dto.thumbnailBase64.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/)
          if (!match) throw new Error('Invalid thumbnail image')
          const bytes = Buffer.from(match[1], 'base64')
          if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error('Invalid thumbnail signature')
          asset.thumbnailPath = path.join('thumbnails', `${asset.id}.jpg`)
          fs.mkdirSync(path.join(project.projectPath, 'thumbnails'), { recursive: true })
          thumbnailFile = path.join(project.projectPath, asset.thumbnailPath)
          fs.writeFileSync(thumbnailFile, bytes, { flag: 'wx' })
        }
        db.run(`INSERT INTO source_assets
          (id, project_id, original_path, filename, duration, width, height, fps, codec, file_size, imported_at, thumbnail_path)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          asset.id, asset.projectId, asset.originalPath, asset.filename, asset.duration ?? null,
          asset.width ?? null, asset.height ?? null, asset.fps ?? null, asset.codec ?? null,
          asset.fileSize!, asset.importedAt, asset.thumbnailPath ?? null
        ])
        return asset
      })
    } catch (error) {
      if (thumbnailFile && fs.existsSync(thumbnailFile)) fs.unlinkSync(thumbnailFile)
      throw error
    }
  }
}
