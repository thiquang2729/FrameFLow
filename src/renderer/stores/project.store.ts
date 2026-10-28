import { create } from 'zustand'
import { Project, ProjectStats, CreateProjectDTO, UpdateProjectDTO } from '@shared/types'
import { confirmNavigation } from '../lib/navigation-guard'

interface ProjectState {
  projects: Project[]
  activeProject: Project | null
  stats: ProjectStats | null
  activeTab: 'overview' | 'review' | 'versions' | 'src' | 'export' | 'ai'
  isLoading: boolean
  error: string | null
  activeVersionId: string | null
  reviewCommentId: string | null

  // Actions
  setActiveTab: (tab: 'overview' | 'review' | 'versions' | 'src' | 'export' | 'ai') => void
  fetchProjects: () => Promise<void>
  selectProject: (projectId: string) => Promise<void>
  createProject: (dto: CreateProjectDTO) => Promise<Project>
  updateProject: (projectId: string, dto: UpdateProjectDTO) => Promise<Project>
  deleteProject: (projectId: string) => Promise<void>
  refreshStats: () => Promise<void>
  selectVersion: (versionId: string) => boolean
  openReview: (versionId: string, commentId?: string) => void
}

let selectionGeneration = 0

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProject: null,
  stats: null,
  activeTab: 'overview',
  isLoading: false,
  error: null,
  activeVersionId: null,
  reviewCommentId: null,

  setActiveTab: (tab) => { if (tab === get().activeTab || confirmNavigation()) set({ activeTab: tab }) },
  selectVersion: (versionId) => {
    if (versionId !== get().activeVersionId && !confirmNavigation()) return false
    set({ activeVersionId: versionId, reviewCommentId: null })
    return true
  },
  openReview: (versionId, commentId) => { if (confirmNavigation()) set({ activeTab: 'review', activeVersionId: versionId, reviewCommentId: commentId || null }) },

  fetchProjects: async () => {
    try {
      set({ isLoading: true, error: null })
      const list = await window.api.listProjects()
      set({ projects: list, isLoading: false })

      // Auto-select first project if none selected
      const current = get().activeProject
      if (!current && list.length > 0) {
        await get().selectProject(list[0].id)
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch projects', isLoading: false })
    }
  },

  selectProject: async (projectId: string) => {
    if (projectId !== get().activeProject?.id && !confirmNavigation()) return
    const generation = ++selectionGeneration
    try {
      set({ isLoading: true, error: null })
      const [proj, stats] = await Promise.all([window.api.getProject(projectId), window.api.getProjectStats(projectId)])
      if (generation !== selectionGeneration) return
      if (!proj) throw new Error('Không tìm thấy dự án.')
      const changed = get().activeProject?.id !== projectId
      set({ activeProject: proj, stats, isLoading: false, ...(changed ? { activeVersionId: null, reviewCommentId: null } : {}) })
    } catch (err: any) {
      if (generation !== selectionGeneration) return
      set({ error: err.message || 'Failed to select project', isLoading: false })
    }
  },

  createProject: async (dto: CreateProjectDTO) => {
    if (!confirmNavigation()) throw new Error('Hãy lưu hoặc hủy ghi chú frame trước khi tạo dự án.')
    const generation = ++selectionGeneration
    try {
      set({ isLoading: true, error: null })
      const newProj = await window.api.createProject(dto)
      const updated = [newProj, ...get().projects]
      if (generation !== selectionGeneration) { set({ projects: updated }); return newProj }
      set({ projects: updated, activeProject: newProj, stats: null, activeVersionId: null, reviewCommentId: null, isLoading: false })
      await get().refreshStats()
      return newProj
    } catch (err: any) {
      set({ error: err.message || 'Failed to create project', isLoading: false })
      throw err
    }
  },

  updateProject: async (projectId: string, dto: UpdateProjectDTO) => {
    try {
      set({ isLoading: true, error: null })
      const updated = await window.api.updateProject(projectId, dto)
      const list = get().projects.map((p) => (p.id === projectId ? updated : p))
      set({
        projects: list,
        activeProject: get().activeProject?.id === projectId ? updated : get().activeProject,
        isLoading: false
      })
      return updated
    } catch (err: any) {
      set({ error: err.message || 'Failed to update project', isLoading: false })
      throw err
    }
  },

  deleteProject: async (projectId: string) => {
    if (projectId === get().activeProject?.id && !confirmNavigation()) return
    try {
      await window.api.deleteProject(projectId)
      const remaining = get().projects.filter((p) => p.id !== projectId)
      if (get().activeProject?.id !== projectId) { set({ projects: remaining }); return }
      ++selectionGeneration
      const nextActive = remaining.length > 0 ? remaining[0] : null
      set({ projects: remaining, activeProject: nextActive, stats: null, activeVersionId: null, reviewCommentId: null })
      if (nextActive) {
        await get().selectProject(nextActive.id)
      } else {
        set({ stats: null })
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete project' })
    }
  },

  refreshStats: async () => {
    const active = get().activeProject
    if (!active) return
    try {
      const stats = await window.api.getProjectStats(active.id)
      if (get().activeProject?.id === active.id) set({ stats })
    } catch {
      // Ignore background stats refresh error
    }
  }
}))
