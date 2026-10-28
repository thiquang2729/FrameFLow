import type { SourceAnalysisIssue, SourceAnalysisSegment, SourceScores } from '../types/source-analysis'

type RecordValue = Record<string, unknown>
function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Kết quả AI không đúng cấu trúc JSON.')
  return value as RecordValue
}
function text(value: unknown, max = 3000): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Văn bản trong kết quả AI không hợp lệ.')
  return value.trim()
}
function score(value: unknown): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10) throw new Error('Điểm AI phải nằm trong khoảng 0–10 hoặc null.')
  return value
}
function range(value: RecordValue, duration: number, offset: number): { startTime: number; endTime: number } {
  const start = value.startTime
  const end = value.endTime
  if (typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= duration || end <= start || end > duration + 0.1) {
    throw new Error('Timestamp AI không thuộc đoạn video đã gửi.')
  }
  return { startTime: offset + Math.min(start, duration), endTime: offset + Math.min(end, duration) }
}

export function validateSourceAnalysis(input: unknown, duration: number, offset: number, hasAudio: boolean): {
  summary: string; audioObserved: boolean; segments: Omit<SourceAnalysisSegment, 'id'>[];
  issues: Omit<SourceAnalysisIssue, 'id'>[]; tags: string[]
} {
  const root = record(input)
  // This declaration is not independent evidence of upstream video support.
  if (root.videoObserved !== true) throw new Error('Model không xác nhận quan sát được video. Không tạo đánh giá từ ảnh hoặc văn bản thay thế.')
  if (typeof root.audioObserved !== 'boolean') throw new Error('AI chưa khai báo phạm vi quan sát âm thanh.')
  const audioObserved = hasAudio && root.audioObserved
  if (!Array.isArray(root.segments) || !root.segments.length || root.segments.length > 60 || !Array.isArray(root.issues) || root.issues.length > 100) {
    throw new Error('Số lượng segment hoặc vấn đề AI không hợp lệ.')
  }
  const segments = root.segments.map((entry) => {
    const row = record(entry)
    const raw = record(row.scores)
    const scores: SourceScores = {
      technical: score(raw.technical), editorial: score(raw.editorial), sharpness: score(raw.sharpness),
      stability: score(raw.stability), exposure: score(raw.exposure), composition: score(raw.composition),
      audio: audioObserved ? score(raw.audio) : null, rationale: text(raw.rationale)
    }
    return { ...range(row, duration, offset), summary: text(row.summary), shotType: text(row.shotType, 120), recommendedUse: text(row.recommendedUse, 500), scores }
  }).sort((a, b) => a.startTime - b.startTime)
  for (let index = 1; index < segments.length; index++) {
    if (segments[index].startTime < segments[index - 1].endTime - 0.05) throw new Error('Các segment AI chồng lấn không hợp lệ.')
  }
  const types: SourceAnalysisIssue['type'][] = ['SHAKE', 'BLUR', 'EXPOSURE', 'COMPOSITION', 'AUDIO', 'OTHER']
  const severities: SourceAnalysisIssue['severity'][] = ['LOW', 'MEDIUM', 'HIGH']
  const issues = root.issues.map((entry) => {
    const row = record(entry)
    if (!types.includes(row.type as SourceAnalysisIssue['type']) || !severities.includes(row.severity as SourceAnalysisIssue['severity'])) throw new Error('Loại hoặc mức độ vấn đề AI không hợp lệ.')
    if (row.type === 'AUDIO' && !audioObserved) throw new Error('AI nhận xét âm thanh khi chưa quan sát được âm thanh.')
    return { ...range(row, duration, offset), type: row.type as SourceAnalysisIssue['type'], severity: row.severity as SourceAnalysisIssue['severity'], description: text(row.description), evidence: text(row.evidence) }
  })
  if (!Array.isArray(root.tags) || root.tags.length > 30) throw new Error('Danh sách tag AI không hợp lệ.')
  return { summary: text(root.summary, 6000), audioObserved, segments, issues, tags: [...new Set(root.tags.map((tag) => text(tag, 100)).filter(Boolean))] }
}
