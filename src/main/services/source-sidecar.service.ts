import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  SourceAnalysisIssue,
  SourceAnalysisSegment,
  SourceDialogueLine,
  SourceSidecarAnalysis
} from '../../shared/types/source-analysis'

export interface SaveSidecarInput {
  fingerprint: string
  duration: number
  width: number
  height: number
  fps: number | null
  fileSize: number
  startTime: number
  endTime: number
  summary: string
  dialogue: SourceDialogueLine[]
  segments: Omit<SourceAnalysisSegment, 'id'>[] | SourceAnalysisSegment[]
  issues: Omit<SourceAnalysisIssue, 'id'>[] | SourceAnalysisIssue[]
  tags: string[]
}

export class SourceSidecarService {
  getSidecarPath(sourceFilePath: string): string {
    const dir = path.dirname(sourceFilePath)
    const baseName = path.parse(sourceFilePath).name
    return path.join(dir, `${baseName}.analysis.json`)
  }

  getAlternativeSidecarPath(sourceFilePath: string): string {
    return `${sourceFilePath}.analysis.json`
  }

  async readSidecar(sourceFilePath: string): Promise<SourceSidecarAnalysis | null> {
    try {
      const primary = this.getSidecarPath(sourceFilePath)
      let targetPath = primary
      let exists = false

      try {
        const stat = await fs.stat(primary)
        if (stat.isFile()) exists = true
      } catch {
        // Primary does not exist, check alternative
        const alt = this.getAlternativeSidecarPath(sourceFilePath)
        try {
          const statAlt = await fs.stat(alt)
          if (statAlt.isFile()) {
            targetPath = alt
            exists = true
          }
        } catch {
          exists = false
        }
      }

      if (!exists) return null

      const content = await fs.readFile(targetPath, 'utf-8')
      const data = JSON.parse(content) as SourceSidecarAnalysis
      if (!data || typeof data !== 'object' || data.version !== '1.0' || !Array.isArray(data.segments)) {
        return null
      }
      return data
    } catch {
      return null
    }
  }

  async mergeAndSave(sourceFilePath: string, input: SaveSidecarInput): Promise<SourceSidecarAnalysis | null> {
    try {
      const sidecarPath = this.getSidecarPath(sourceFilePath)
      const existing = await this.readSidecar(sourceFilePath)
      const fileName = path.basename(sourceFilePath)
      const now = new Date().toISOString()

      const sStart = input.startTime
      const sEnd = input.endTime

      // 1. Dialogue: keep non-overlapping lines, append new ones, sort
      const prevDialogue = existing?.dialogue || []
      const retainedDialogue = prevDialogue.filter((d) => d.endTime <= sStart || d.startTime >= sEnd)
      const mergedDialogue = [...retainedDialogue, ...input.dialogue].sort((a, b) => a.startTime - b.startTime)

      // 2. Segments: keep non-overlapping segments, append new ones, sort
      const prevSegments = existing?.segments || []
      const retainedSegments = prevSegments.filter((s) => s.endTime <= sStart + 0.05 || s.startTime >= sEnd - 0.05)
      const newSegmentsWithIds: SourceAnalysisSegment[] = input.segments.map((s, idx) => ({
        id: (s as SourceAnalysisSegment).id || `seg_${idx + 1}_${Date.now()}`,
        startTime: s.startTime,
        endTime: s.endTime,
        summary: s.summary,
        shotType: s.shotType,
        recommendedUse: s.recommendedUse,
        scores: s.scores
      }))
      const mergedSegments = [...retainedSegments, ...newSegmentsWithIds].sort((a, b) => a.startTime - b.startTime)

      // 3. Issues: keep non-overlapping issues, append new ones, sort
      const prevIssues = existing?.issues || []
      const retainedIssues = prevIssues.filter((i) => i.endTime <= sStart || i.startTime >= sEnd)
      const newIssuesWithIds: SourceAnalysisIssue[] = input.issues.map((i, idx) => ({
        id: (i as SourceAnalysisIssue).id || `iss_${idx + 1}_${Date.now()}`,
        startTime: i.startTime,
        endTime: i.endTime,
        type: i.type,
        severity: i.severity,
        description: i.description,
        evidence: i.evidence
      }))
      const mergedIssues = [...retainedIssues, ...newIssuesWithIds].sort((a, b) => a.startTime - b.startTime)

      // 4. Tags: union unique tags
      const mergedTags = Array.from(new Set([...(existing?.tags || []), ...input.tags]))

      // 5. Summary
      let mergedSummary = input.summary
      if (existing?.overallSummary && existing.overallSummary !== input.summary) {
        if (!existing.overallSummary.includes(input.summary)) {
          mergedSummary = `${existing.overallSummary}\n---\n${input.summary}`
        } else {
          mergedSummary = existing.overallSummary
        }
      }

      const sidecarData: SourceSidecarAnalysis = {
        version: '1.0',
        updatedAt: now,
        source: {
          fileName,
          filePath: sourceFilePath,
          fingerprint: input.fingerprint || existing?.source.fingerprint || '',
          duration: input.duration || existing?.source.duration || 0,
          width: input.width || existing?.source.width || 0,
          height: input.height || existing?.source.height || 0,
          fps: input.fps ?? existing?.source.fps ?? null,
          fileSize: input.fileSize || existing?.source.fileSize || 0
        },
        overallSummary: mergedSummary,
        dialogue: mergedDialogue,
        segments: mergedSegments,
        issues: mergedIssues,
        tags: mergedTags
      }

      // Safe atomic write
      const tempPath = `${sidecarPath}.tmp-${Date.now()}`
      await fs.writeFile(tempPath, JSON.stringify(sidecarData, null, 2), 'utf-8')
      await fs.rename(tempPath, sidecarPath)

      return sidecarData
    } catch (err) {
      console.warn(`[SourceSidecar] Không thể lưu file sidecar cho ${sourceFilePath}:`, err)
      return null
    }
  }
}
