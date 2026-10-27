import fs from 'fs'
import path from 'path'
import { ulid } from 'ulid'
import {
  CreateCommentDTO,
  ReviewAttachment,
  ReviewComment,
  UpdateCommentStatusDTO
} from '@shared/types'
import { ProjectService } from './project.service'

export class ReviewService {
  constructor(private projectService: ProjectService) {}

  public async getComments(projectId: string, versionId: string): Promise<ReviewComment[]> {
    const db = await this.projectService.getDb(projectId)

    const commentRows = db.query<any>(
      `SELECT id, project_id, edit_version_id, timestamp, frame_number, category, priority, content, status, created_by, created_at, resolved_at
       FROM review_comments
       WHERE project_id = ? AND edit_version_id = ?
       ORDER BY timestamp ASC`,
      [projectId, versionId]
    )

    const comments: ReviewComment[] = []

    for (const r of commentRows) {
      // Fetch attachments
      const attachRows = db.query<any>(
        `SELECT id, review_comment_id, type, file_path, width, height, created_at
         FROM review_attachments
         WHERE review_comment_id = ?`,
        [r.id]
      )
      const attachments: ReviewAttachment[] = attachRows.map((a) => ({
        id: a.id,
        reviewCommentId: a.review_comment_id,
        type: a.type,
        filePath: a.file_path,
        width: a.width,
        height: a.height,
        createdAt: a.created_at
      }))

      // Fetch annotations
      const annRows = db.query<any>(
        `SELECT id, review_comment_id, type, data_json, created_at
         FROM annotations
         WHERE review_comment_id = ?`,
        [r.id]
      )
      const annotations = annRows.map((an) => ({
        id: an.id,
        reviewCommentId: an.review_comment_id,
        type: an.type,
        data: JSON.parse(an.data_json),
        createdAt: an.created_at
      }))

      comments.push({
        id: r.id,
        projectId: r.project_id,
        editVersionId: r.edit_version_id,
        timestamp: r.timestamp,
        frameNumber: r.frame_number,
        category: r.category,
        priority: r.priority,
        content: r.content,
        status: r.status,
        createdBy: r.created_by,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at,
        attachments,
        annotations
      })
    }

    return comments
  }

  public async createComment(dto: CreateCommentDTO): Promise<ReviewComment> {
    const project = await this.projectService.getProject(dto.projectId)
    if (!project) throw new Error('Project not found')
    const db = await this.projectService.getDb(dto.projectId)

    const version = db.get<{ fps: number; duration: number }>(
      'SELECT fps, duration FROM edit_versions WHERE id = ? AND project_id = ?',
      [dto.editVersionId, dto.projectId]
    )
    if (!version) throw new Error('Version does not belong to this project')
    if (!Number.isFinite(dto.timestamp) || dto.timestamp < 0 ||
      (version.duration > 0 && dto.timestamp > version.duration)) {
      throw new Error('Invalid comment timestamp')
    }
    if (typeof dto.content !== 'string' || !dto.content.trim()) throw new Error('Comment content is required')
    if (!['SUBTITLE', 'PACING', 'AUDIO', 'COLOR', 'CUT', 'EFFECT', 'GRAPHICS', 'GENERAL'].includes(dto.category)) {
      throw new Error('Invalid comment category')
    }
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(dto.priority)) throw new Error('Invalid comment priority')
    if (dto.frameNumber != null && (!Number.isInteger(dto.frameNumber) || dto.frameNumber < 0)) {
      throw new Error('Invalid frame number')
    }
    const frameNumber = dto.frameNumber ?? Math.round(dto.timestamp * (version.fps > 0 ? version.fps : 30))

    // Generate short human-readable review ID: R001, R002...
    const sequenceRow = db.get<{ sequence: number }>(
      `SELECT COALESCE(MAX(CAST(SUBSTR(id, 2) AS INTEGER)), 0) AS sequence FROM review_comments WHERE id GLOB 'R[0-9]*'`
    )
    const nextSeq = (sequenceRow?.sequence || 0) + 1
    const reviewId = `R${String(nextSeq).padStart(3, '0')}`
    const now = new Date().toISOString()

    // 1. Insert ReviewComment
    db.run(
      `INSERT INTO review_comments (id, project_id, edit_version_id, timestamp, frame_number, category, priority, content, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reviewId,
        dto.projectId,
        dto.editVersionId,
        dto.timestamp,
        frameNumber,
        dto.category,
        dto.priority,
        dto.content.trim(),
        'OPEN',
        'User',
        now
      ]
    )

    const attachments: ReviewAttachment[] = []

    // 2. Save captured frame if provided
    if (dto.frameBase64) {
      const frameFileName = `${reviewId}.jpg`
      const frameRelPath = path.join('frames', frameFileName)
      const frameAbsPath = path.join(project.projectPath, frameRelPath)

      const base64Data = dto.frameBase64.replace(/^data:image\/\w+;base64,/, '')
      fs.writeFileSync(frameAbsPath, Buffer.from(base64Data, 'base64'))

      const attachId = ulid()
      db.run(
        `INSERT INTO review_attachments (id, review_comment_id, type, file_path, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [attachId, reviewId, 'FRAME', frameRelPath, now]
      )

      attachments.push({
        id: attachId,
        reviewCommentId: reviewId,
        type: 'FRAME',
        filePath: frameRelPath,
        createdAt: now
      })
    }

    // 3. Save annotated frame if provided
    if (dto.annotatedFrameBase64) {
      const annFileName = `${reviewId}.png`
      const annRelPath = path.join('annotations', annFileName)
      const annAbsPath = path.join(project.projectPath, annRelPath)

      const base64Data = dto.annotatedFrameBase64.replace(/^data:image\/\w+;base64,/, '')
      fs.writeFileSync(annAbsPath, Buffer.from(base64Data, 'base64'))

      const attachId = ulid()
      db.run(
        `INSERT INTO review_attachments (id, review_comment_id, type, file_path, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [attachId, reviewId, 'ANNOTATED_FRAME', annRelPath, now]
      )

      attachments.push({
        id: attachId,
        reviewCommentId: reviewId,
        type: 'ANNOTATED_FRAME',
        filePath: annRelPath,
        createdAt: now
      })
    }

    // 4. Save annotation drawing objects
    const annotations: any[] = []
    if (dto.annotations && dto.annotations.length > 0) {
      for (const ann of dto.annotations) {
        const annId = ulid()
        db.run(
          `INSERT INTO annotations (id, review_comment_id, type, data_json, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [annId, reviewId, ann.type, JSON.stringify(ann.data), now]
        )
        annotations.push({
          id: annId,
          reviewCommentId: reviewId,
          type: ann.type,
          data: ann.data,
          createdAt: now
        })
      }
    }

    return {
      id: reviewId,
      projectId: dto.projectId,
      editVersionId: dto.editVersionId,
      timestamp: dto.timestamp,
      frameNumber,
      category: dto.category,
      priority: dto.priority,
      content: dto.content.trim(),
      status: 'OPEN',
      createdBy: 'User',
      createdAt: now,
      attachments,
      annotations
    }
  }

  public async updateStatus(dto: UpdateCommentStatusDTO & { projectId: string }): Promise<boolean> {
    if (!['OPEN', 'IN_PROGRESS', 'FIXED', 'PARTIAL', 'REJECTED'].includes(dto.status)) {
      throw new Error('Invalid comment status')
    }
    const db = await this.projectService.getDb(dto.projectId)
    if (!db.get('SELECT id FROM review_comments WHERE id = ? AND project_id = ?', [dto.commentId, dto.projectId])) {
      throw new Error('Comment not found in this project')
    }
    const now = new Date().toISOString()
    const resolvedAt = dto.status === 'FIXED' ? now : null

    db.run(
      `UPDATE review_comments
       SET status = ?, resolved_at = ?
        WHERE id = ? AND project_id = ?`,
      [dto.status, resolvedAt, dto.commentId, dto.projectId]
    )
    return true
  }

  public async deleteComment(projectId: string, commentId: string): Promise<boolean> {
    const db = await this.projectService.getDb(projectId)
    db.run(`DELETE FROM review_comments WHERE id = ?`, [commentId])
    return true
  }
}
