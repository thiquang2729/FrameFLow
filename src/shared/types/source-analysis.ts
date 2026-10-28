export type AnalysisState = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'INTERRUPTED'
export type AnalysisReview = 'UNREVIEWED' | 'ACCEPTED' | 'REJECTED'

export interface SourceScores {
  technical: number | null
  editorial: number | null
  sharpness: number | null
  stability: number | null
  exposure: number | null
  composition: number | null
  audio: number | null
  rationale: string
}

export interface SourceAnalysisSegment {
  id: string
  startTime: number
  endTime: number
  summary: string
  shotType: string
  recommendedUse: string
  scores: SourceScores
}

export interface SourceAnalysisIssue {
  id: string
  startTime: number
  endTime: number
  type: 'SHAKE' | 'BLUR' | 'EXPOSURE' | 'COMPOSITION' | 'AUDIO' | 'OTHER'
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  description: string
  evidence: string
}

export interface SourceAnalysisRun {
  id: string
  sourceAssetId: string
  state: AnalysisState
  model: string
  returnedModel: string | null
  protocol: 'gemini-inline-video'
  promptVersion: string
  createdAt: string
  completedAt: string | null
  startTime: number
  endTime: number
  summary: string
  audioObserved: boolean
  mediaMethod: 'original' | 'transcoded'
  mediaNote: string
  review: AnalysisReview
  userNote: string
  brief: string
  error: string | null
  stale: boolean
  fileChanged: boolean
  briefChanged: boolean
  criteriaChanged: boolean
  segments: SourceAnalysisSegment[]
  issues: SourceAnalysisIssue[]
  tags: string[]
  userTags: string[]
}

export interface SourceAnalysisRequest {
  projectId: string
  sourceAssetId: string
  model: string
  startTime: number
  endTime: number
  consent: boolean
}

export interface SourceMediaInfo {
  duration: number
  width: number
  height: number
  fps: number | null
  codec: string
  hasAudio: boolean
  audioCodec: string | null
  fileSize: number
  fingerprint: string
}

export interface SourceAnalysisEnvironment {
  mediaReady: boolean
  mediaMessage: string
  aiReady: boolean
  models: string[]
  selectedModel: string
  videoRoute: 'UNVERIFIED'
  maxDuration: number
  maxVideoBytes: number
}

export interface SourceAnalysisOverview {
  sourceAssetId: string
  latestState: AnalysisState
  runId: string | null
  summary: string
  technical: number | null
  editorial: number | null
  startTime: number | null
  endTime: number | null
  tags: string[]
  shotTypes: string[]
  recommendedUses: string[]
  issueTypes: string[]
  stale: boolean
  rejected: boolean
}
