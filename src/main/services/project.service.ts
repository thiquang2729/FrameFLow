import fs from 'fs'
import path from 'path'
import os from 'os'
import { ulid } from 'ulid'
import { CreateProjectDTO, Project, ProjectStats, UpdateProjectDTO } from '@shared/types'
import { DatabaseManager } from '../database/db'

export class ProjectService {
  private activeDatabases: Map<string, DatabaseManager> = new Map()
  private databaseLoads = new Map<string, Promise<DatabaseManager>>()
  private appDataDir: string
  private registryFile: string

  constructor(registryDirectory = path.join(os.homedir(), '.frameflow')) {
    this.appDataDir = registryDirectory
    this.registryFile = path.join(this.appDataDir, 'projects.json')
    if (!fs.existsSync(this.appDataDir)) {
      fs.mkdirSync(this.appDataDir, { recursive: true })
    }
    if (!fs.existsSync(this.registryFile)) {
      fs.writeFileSync(this.registryFile, JSON.stringify([]))
    }
  }

  public getProjects(): Project[] {
    try {
      const data = fs.readFileSync(this.registryFile, 'utf-8')
      const projects: Project[] = JSON.parse(data)
      return projects.filter((p) => fs.existsSync(p.projectPath))
    } catch {
      return []
    }
  }

  private saveRegistry(projects: Project[]): void {
    const temporary = `${this.registryFile}.tmp`
    fs.writeFileSync(temporary, JSON.stringify(projects, null, 2))
    fs.renameSync(temporary, this.registryFile)
  }

  public async getDb(projectId: string): Promise<DatabaseManager> {
    if (this.activeDatabases.has(projectId)) {
      return this.activeDatabases.get(projectId)!
    }

    const pending = this.databaseLoads.get(projectId)
    if (pending) return pending
    const loading = (async () => {
      const proj = this.getProjects().find((project) => project.id === projectId)
      if (!proj) throw new Error(`Project ${projectId} not found`)
      const db = new DatabaseManager(path.join(proj.projectPath, 'project.db'))
      await db.init()
      this.activeDatabases.set(projectId, db)
      return db
    })()
    this.databaseLoads.set(projectId, loading)
    try { return await loading } finally { this.databaseLoads.delete(projectId) }
  }

  public async createProject(dto: CreateProjectDTO): Promise<Project> {
    if (typeof dto.name !== 'string' || !dto.name.trim() || dto.name.length > 120) throw new Error('Tên dự án phải có từ 1 đến 120 ký tự.')
    if (dto.targetDuration !== undefined && (!Number.isFinite(dto.targetDuration) || dto.targetDuration <= 0)) throw new Error('Thời lượng mục tiêu phải lớn hơn 0.')
    const id = ulid()
    const baseDir = dto.projectDir || path.join(os.homedir(), 'FrameFlowProjects')
    if (!path.isAbsolute(baseDir)) throw new Error('Thư mục dự án phải là đường dẫn tuyệt đối.')
    const folderName = dto.name.trim().normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(0, 80) || 'Project'
    // Separate IDs always own separate databases, even with the same display name.
    const projectPath = path.join(baseDir, `${folderName}_${id}`)

    // 1. Create directory structure as specified in DOCX Table 15
    const subdirs = [
      'source',
      'proxy',
      'thumbnails',
      'frames',
      'annotations',
      'versions',
      'exports'
    ]

    fs.mkdirSync(projectPath, { recursive: true })
    for (const sub of subdirs) {
      fs.mkdirSync(path.join(projectPath, sub), { recursive: true })
    }

    const now = new Date().toISOString()
    const project: Project = {
      id,
      name: dto.name.trim(),
      description: dto.description || '',
      script: dto.script || '',
      targetPlatform: dto.targetPlatform || 'TikTok',
      targetDuration: dto.targetDuration || 60,
      aspectRatio: dto.aspectRatio || '9:16',
      status: 'PLANNING',
      projectPath,
      createdAt: now,
      updatedAt: now
    }

    // 2. Initialize project.db
    const dbPath = path.join(projectPath, 'project.db')
    const db = new DatabaseManager(dbPath)
    await db.init()

    db.run(
      `INSERT INTO projects (id, name, description, script, target_platform, target_duration, aspect_ratio, status, project_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        project.name,
        project.description,
        project.script,
        project.targetPlatform,
        project.targetDuration,
        project.aspectRatio,
        project.status,
        project.projectPath,
        project.createdAt,
        project.updatedAt
      ]
    )

    this.activeDatabases.set(id, db)

    // 3. Register project
    const all = this.getProjects()
    all.unshift(project)
    this.saveRegistry(all)

    return project
  }

  public async getProject(projectId: string): Promise<Project | null> {
    const list = this.getProjects()
    const found = list.find((p) => p.id === projectId)
    if (!found) return null
    try {
      const db = await this.getDb(projectId)
      const row = db.get<Record<string, unknown>>('SELECT * FROM projects WHERE id = ?', [projectId])
      if (row) {
        return {
          id: String(row.id),
          name: String(row.name),
          description: typeof row.description === 'string' ? row.description : found.description || '',
          script: typeof row.script === 'string' ? row.script : found.script || '',
          targetPlatform: typeof row.target_platform === 'string' ? row.target_platform : found.targetPlatform,
          targetDuration: typeof row.target_duration === 'number' ? row.target_duration : found.targetDuration,
          aspectRatio: typeof row.aspect_ratio === 'string' ? row.aspect_ratio : found.aspectRatio,
          status: (typeof row.status === 'string' ? row.status : found.status) as Project['status'],
          projectPath: found.projectPath,
          createdAt: typeof row.created_at === 'string' ? row.created_at : found.createdAt,
          updatedAt: typeof row.updated_at === 'string' ? row.updated_at : found.updatedAt
        }
      }
    } catch {
      // fallback to registry
    }
    return found
  }

  public async updateProject(projectId: string, dto: UpdateProjectDTO): Promise<Project> {
    const projects = this.getProjects()
    const index = projects.findIndex((p) => p.id === projectId)
    if (index === -1) throw new Error(`Project ${projectId} not found`)

    const existing = projects[index]
    const updated: Project = {
      ...existing,
      name: dto.name !== undefined ? dto.name.trim() : existing.name,
      description: dto.description !== undefined ? dto.description : existing.description,
      script: dto.script !== undefined ? dto.script : existing.script,
      targetPlatform: dto.targetPlatform !== undefined ? dto.targetPlatform : existing.targetPlatform,
      targetDuration: dto.targetDuration !== undefined ? dto.targetDuration : existing.targetDuration,
      aspectRatio: dto.aspectRatio !== undefined ? dto.aspectRatio : existing.aspectRatio,
      status: dto.status !== undefined ? dto.status : existing.status,
      updatedAt: new Date().toISOString()
    }

    // Update in database
    const db = await this.getDb(projectId)
    db.run(
      `UPDATE projects SET name = ?, description = ?, script = ?, target_platform = ?, target_duration = ?, aspect_ratio = ?, status = ?, updated_at = ? WHERE id = ?`,
      [
        updated.name,
        updated.description || '',
        updated.script || '',
        updated.targetPlatform || null,
        updated.targetDuration || null,
        updated.aspectRatio || null,
        updated.status,
        updated.updatedAt,
        projectId
      ]
    )

    // Update in registry
    projects[index] = updated
    this.saveRegistry(projects)

    return updated
  }

  public async getProjectStats(projectId: string): Promise<ProjectStats> {
    const db = await this.getDb(projectId)

    const sourceRow = db.get<{ count: number }>(`SELECT COUNT(*) as count FROM source_assets WHERE project_id = ?`, [projectId])
    const versionRow = db.get<{ count: number }>(`SELECT COUNT(*) as count FROM edit_versions WHERE project_id = ?`, [projectId])
    const openReviewRow = db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM review_comments WHERE project_id = ? AND status IN ('OPEN', 'IN_PROGRESS', 'PARTIAL')`, [projectId]
    )
    const highPriorityRow = db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM review_comments WHERE project_id = ? AND status IN ('OPEN', 'IN_PROGRESS', 'PARTIAL') AND priority IN ('HIGH', 'CRITICAL')`, [projectId]
    )

    return {
      sourceCount: sourceRow?.count || 0,
      versionCount: versionRow?.count || 0,
      openReviewCount: openReviewRow?.count || 0,
      highPriorityCount: highPriorityRow?.count || 0
    }
  }

  public async deleteProject(projectId: string): Promise<boolean> {
    const projects = this.getProjects()
    const proj = projects.find((p) => p.id === projectId)
    if (!proj) return false

    // Close db if open
    if (this.activeDatabases.has(projectId)) {
      this.activeDatabases.get(projectId)!.close()
      this.activeDatabases.delete(projectId)
    }

    // Remove from registry
    const updated = projects.filter((p) => p.id !== projectId)
    this.saveRegistry(updated)
    return true
  }
}
