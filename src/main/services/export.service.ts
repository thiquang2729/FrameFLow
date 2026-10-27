import fs from 'fs'
import path from 'path'
import { ulid } from 'ulid'
import {
  CreateRevisionPackageDTO,
  RevisionPackage,
  RevisionPackageJson,
  RevisionPackageReviewItem
} from '@shared/types'
import { ProjectService } from './project.service'
import { ReviewService } from './review.service'
import { VersionService } from './version.service'

export class ExportService {
  constructor(
    private projectService: ProjectService,
    private reviewService: ReviewService,
    private versionService: VersionService
  ) {}

  public async createPackage(dto: CreateRevisionPackageDTO): Promise<RevisionPackage> {
    const project = await this.projectService.getProject(dto.projectId)
    if (!project) throw new Error('Project not found')
    const db = await this.projectService.getDb(dto.projectId)

    const versions = await this.versionService.getVersions(dto.projectId)
    const sourceVersion = versions.find((v) => v.id === dto.sourceVersionId)
    const sourceVersionName = sourceVersion?.name || 'Draft V1'
    const targetVersionName = dto.targetVersionName || 'Draft V2'

    // Create unique package folder name, e.g. "revision_Draft_V1_to_Draft_V2_20261027"
    const sanitizedSource = sourceVersionName.replace(/[^a-zA-Z0-9_-]/g, '_')
    const sanitizedTarget = targetVersionName.replace(/[^a-zA-Z0-9_-]/g, '_')
    const timestampStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const packageName = `revision_${sanitizedSource}_to_${sanitizedTarget}_${timestampStr}`

    const packageDir = path.join(project.projectPath, 'exports', packageName)
    const framesDir = path.join(packageDir, 'frames')
    const annotatedDir = path.join(packageDir, 'annotated')

    fs.mkdirSync(packageDir, { recursive: true })
    fs.mkdirSync(framesDir, { recursive: true })
    fs.mkdirSync(annotatedDir, { recursive: true })

    // Fetch all comments for source version
    const allComments = await this.reviewService.getComments(dto.projectId, dto.sourceVersionId)
    const selectedComments = allComments.filter((c) => dto.commentIds.includes(c.id))

    const reviewItems: RevisionPackageReviewItem[] = []

    for (const c of selectedComments) {
      let frameRelPath: string | undefined
      let annRelPath: string | undefined

      // Copy frame attachment if exists
      const frameAttach = c.attachments?.find((a) => a.type === 'FRAME')
      if (frameAttach) {
        const srcAbs = path.join(project.projectPath, frameAttach.filePath)
        if (fs.existsSync(srcAbs)) {
          const destName = path.basename(frameAttach.filePath)
          const destAbs = path.join(framesDir, destName)
          fs.copyFileSync(srcAbs, destAbs)
          frameRelPath = `frames/${destName}`
        }
      }

      // Copy annotated frame attachment if exists
      const annAttach = c.attachments?.find((a) => a.type === 'ANNOTATED_FRAME')
      if (annAttach) {
        const srcAbs = path.join(project.projectPath, annAttach.filePath)
        if (fs.existsSync(srcAbs)) {
          const destName = path.basename(annAttach.filePath)
          const destAbs = path.join(annotatedDir, destName)
          fs.copyFileSync(srcAbs, destAbs)
          annRelPath = `annotated/${destName}`
        }
      }

      reviewItems.push({
        id: c.id,
        timestamp: c.timestamp,
        frame: c.frameNumber,
        category: c.category.toLowerCase(),
        priority: c.priority.toLowerCase(),
        comment: c.content,
        frameImage: frameRelPath,
        annotationImage: annRelPath
      })
    }

    // 1. Write review.json (as specified in DOCX Table 32)
    const reviewJsonData: RevisionPackageJson = {
      projectName: project.name,
      sourceVersion: sourceVersionName,
      targetVersion: targetVersionName,
      exportedAt: new Date().toISOString(),
      instructions: dto.instructions || '',
      reviews: reviewItems
    }
    fs.writeFileSync(
      path.join(packageDir, 'review.json'),
      JSON.stringify(reviewJsonData, null, 2),
      'utf-8'
    )

    // 2. Write instructions.md
    const instructionsContent = `# Revision Instructions for AI Agent / Video Editor

**Project:** ${project.name}
**Target Platform:** ${project.targetPlatform || 'N/A'}
**Target Duration:** ${project.targetDuration || 0}s
**Source Version:** ${sourceVersionName}
**Target Version:** ${targetVersionName}

## General Instructions
${dto.instructions || 'Fix all highlighted issues according to the review list below. Do not alter approved segments.'}

## Summary of Action Items
Total Feedback Items: ${reviewItems.length}
- High / Critical: ${reviewItems.filter((r) => r.priority === 'high' || r.priority === 'critical').length}
- Medium: ${reviewItems.filter((r) => r.priority === 'medium').length}
- Low: ${reviewItems.filter((r) => r.priority === 'low').length}
`
    fs.writeFileSync(path.join(packageDir, 'instructions.md'), instructionsContent, 'utf-8')

    // 3. Write README.md
    const readmeContent = `# FrameFlow Revision Package: ${sourceVersionName} → ${targetVersionName}

This revision package was automatically compiled by FrameFlow for post-production fixing.

## Directory Contents
- \`review.json\`: Structured feedback items with timestamps, categories, and image links.
- \`instructions.md\`: High-level directives for the editor/agent.
- \`frames/\`: Raw captured video frames at exact feedback timestamps.
- \`annotated/\`: Visual markup images showing exact issues and instructions.

Generated on: ${new Date().toLocaleString()}
`
    fs.writeFileSync(path.join(packageDir, 'README.md'), readmeContent, 'utf-8')

    // Record in DB
    const packageId = ulid()
    const now = new Date().toISOString()
    db.run(
      `INSERT INTO revision_packages (id, project_id, source_version_id, package_path, instructions, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [packageId, project.id, dto.sourceVersionId, packageDir, dto.instructions || '', now]
    )

    return {
      id: packageId,
      projectId: project.id,
      sourceVersionId: dto.sourceVersionId,
      packagePath: packageDir,
      instructions: dto.instructions,
      createdAt: now
    }
  }
}
