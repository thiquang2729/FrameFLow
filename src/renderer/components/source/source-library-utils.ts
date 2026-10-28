import type { SourceAnalysisOverview } from '../../../shared/types/source-analysis'

export const mediaDuration = (value?: number): string => value !== undefined && Number.isFinite(value)
  ? `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '—'

export const mediaSize = (value = 0): string => {
  if (!value) return '0 B'
  const unit = Math.min(3, Math.floor(Math.log(value) / Math.log(1024)))
  return `${(value / 1024 ** unit).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ${['B', 'KB', 'MB', 'GB'][unit]}`
}

export const mediaResolution = (width?: number, height?: number): string => {
  if (!width || !height) return 'Chưa rõ độ phân giải'
  if (Math.max(width, height) >= 3840) return '4K'
  if (Math.max(width, height) >= 2560) return '2K'
  if (Math.min(width, height) >= 1080) return '1080p'
  if (Math.min(width, height) >= 720) return '720p'
  return `${width}×${height}`
}

export const scoreTone = (score: number): 'good' | 'fair' | 'poor' => score >= 8 ? 'good' : score >= 6 ? 'fair' : 'poor'
export const usableAnalysis = (analysis?: SourceAnalysisOverview): boolean => Boolean(analysis?.runId && !analysis.stale && !analysis.rejected)

export const tagTone = (tag: string): string => {
  if (/rung|cháy sáng|out nét|mờ|shake|blur|overexposure/i.test(tag)) return 'issue'
  if (/ổn định|stable|sharp|sắc nét/i.test(tag)) return 'good'
  if (/b.?roll|phỏng vấn|interview|cận cảnh|close.?up|wide|điện ảnh|opening|tracking/i.test(tag)) return 'blue'
  return 'neutral'
}

export const issueLabels: Record<string, string> = {
  SHAKE: 'Rung hình', BLUR: 'Thiếu nét', EXPOSURE: 'Phơi sáng', COMPOSITION: 'Bố cục', OTHER: 'Khác'
}
