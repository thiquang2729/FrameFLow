import { ulid } from 'ulid'
import fs from 'fs'
import path from 'path'
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
      duration: r.duration ?? undefined,
      fps: r.fps ?? undefined,
      width: r.width ?? undefined,
      height: r.height ?? undefined,
      parentVersionId: r.parent_version_id,
      createdBy: r.created_by,
      createdAt: r.created_at
    }))
  }

  public async createVersion(dto: CreateVersionDTO): Promise<EditVersion> {
    if (!Number.isSafeInteger(dto.versionNumber) || dto.versionNumber < 1) throw new Error('Số phiên bản phải là số nguyên dương.')
    if (typeof dto.name !== 'string' || !dto.name.trim() || dto.name.length > 120) throw new Error('Tên phiên bản phải có từ 1 đến 120 ký tự.')
    if (typeof dto.videoPath !== 'string' || !path.isAbsolute(dto.videoPath) || !/\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(dto.videoPath)) throw new Error('Hãy chọn một tệp video với đường dẫn tuyệt đối.')
    for (const key of ['duration', 'fps', 'width', 'height'] as const) {
      const value = dto[key]
      if (value !== undefined && (!Number.isFinite(value) || value < 0 || (key !== 'duration' && value === 0) ||
        ((key === 'width' || key === 'height') && !Number.isInteger(value)))) throw new Error(`Metadata ${key} không hợp lệ.`)
    }
    if (dto.createdBy !== undefined && !['USER', 'AGENT'].includes(dto.createdBy)) throw new Error('Invalid version creator')
    const videoPath = await fs.promises.realpath(dto.videoPath)
    if (!(await fs.promises.stat(videoPath)).isFile()) throw new Error('Tệp video không tồn tại.')
    if (!await this.projectService.getProject(dto.projectId)) throw new Error('Không tìm thấy dự án.')
    const db = await this.projectService.getDb(dto.projectId)
    if (db.get('SELECT id FROM edit_versions WHERE project_id = ? AND version_number = ?', [dto.projectId, dto.versionNumber])) throw new Error('Số phiên bản đã tồn tại. Hãy tải lại danh sách.')
    if (dto.parentVersionId) {
      const parent = db.get<{ version_number: number }>('SELECT version_number FROM edit_versions WHERE id = ? AND project_id = ?', [dto.parentVersionId, dto.projectId])
      if (!parent || parent.version_number >= dto.versionNumber) throw new Error('Phiên bản cha phải thuộc cùng dự án và có số nhỏ hơn.')
    }
    const id = ulid()
    const now = new Date().toISOString()

    const version: EditVersion = {
      id,
      projectId: dto.projectId,
      versionNumber: dto.versionNumber,
      name: dto.name.trim(),
      videoPath,
      duration: dto.duration || undefined,
      fps: dto.fps,
      width: dto.width,
      height: dto.height,
      parentVersionId: dto.parentVersionId || null,
      createdBy: dto.createdBy || 'USER',
      createdAt: now
    }

    db.transaction(() => db.run(
      `INSERT INTO edit_versions (id, project_id, version_number, name, video_path, duration, fps, width, height, parent_version_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        version.id,
        version.projectId,
        version.versionNumber,
        version.name,
        version.videoPath,
        version.duration ?? null,
        version.fps ?? null,
        version.width ?? null,
        version.height ?? null,
        version.parentVersionId,
        version.createdBy,
        version.createdAt
      ]
    ))

    return version
  }
}
