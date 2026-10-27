import { ulid } from 'ulid'
import { CreateVersionDTO, EditVersion } from '@shared/types'
import { ProjectService } from './project.service'

export class VersionService {
  constructor(private projectService: ProjectService) {}

  public async getVersions(projectId: string): Promise<EditVersion[]> {
    const db = await this.projectService.getDb(projectId)
    const rows = db.query<any>(
      `SELECT id, project_id, version_number, name, video_path, duration, fps, width, height, parent_version_id, created_by, created_at
       FROM edit_versions
       WHERE project_id = ?
       ORDER BY version_number ASC`,
      [projectId]
    )

    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      versionNumber: r.version_number,
      name: r.name,
      videoPath: r.video_path,
      duration: r.duration,
      fps: r.fps,
      width: r.width,
      height: r.height,
      parentVersionId: r.parent_version_id,
      createdBy: r.created_by,
      createdAt: r.created_at
    }))
  }

  public async createVersion(dto: CreateVersionDTO): Promise<EditVersion> {
    const db = await this.projectService.getDb(dto.projectId)
    const id = ulid()
    const now = new Date().toISOString()

    const version: EditVersion = {
      id,
      projectId: dto.projectId,
      versionNumber: dto.versionNumber,
      name: dto.name,
      videoPath: dto.videoPath,
      duration: dto.duration || 0,
      fps: dto.fps || 30,
      width: dto.width || 1920,
      height: dto.height || 1080,
      parentVersionId: dto.parentVersionId || null,
      createdBy: dto.createdBy || 'USER',
      createdAt: now
    }

    db.run(
      `INSERT INTO edit_versions (id, project_id, version_number, name, video_path, duration, fps, width, height, parent_version_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        version.id,
        version.projectId,
        version.versionNumber,
        version.name,
        version.videoPath,
        version.duration,
        version.fps,
        version.width,
        version.height,
        version.parentVersionId,
        version.createdBy,
        version.createdAt
      ]
    )

    return version
  }
}
