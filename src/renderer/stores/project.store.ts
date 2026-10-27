import { create } from 'zustand'
import { Project, ProjectStats, CreateProjectDTO } from '@shared/types'

interface ProjectState {
  projects: Project[]
  activeProject: Project | null
  stats: ProjectStats | null
  activeTab: 'overview' | 'review' | 'versions' | 'src' | 'export'
  isLoading: boolean
  error: string | null

  // Actions
  setActiveTab: (tab: 'overview' | 'review' | 'versions' | 'src' | 'export') => void
  fetchProjects: () => Promise<void>
  selectProject: (projectId: string) => Promise<void>
  createProject: (dto: CreateProjectDTO) => Promise<Project>
  deleteProject: (projectId: string) => Promise<void>
  refreshStats: () => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProject: null,
  stats: null,
  activeTab: 'overview',
  isLoading: false,
  error: null,

  setActiveTab: (tab) => set({ activeTab: tab }),

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
    try {
      set({ isLoading: true })
      const proj = await window.api.getProject(projectId)
      const stats = await window.api.getProjectStats(projectId)
      set({ activeProject: proj, stats, isLoading: false })
    } catch (err: any) {
      set({ error: err.message || 'Failed to select project', isLoading: false })
    }
  },

  createProject: async (dto: CreateProjectDTO) => {
    try {
      set({ isLoading: true, error: null })
      const newProj = await window.api.createProject(dto)
      const updated = [newProj, ...get().projects]
      set({ projects: updated, activeProject: newProj, isLoading: false })
      await get().refreshStats()
      return newProj
    } catch (err: any) {
      set({ error: err.message || 'Failed to create project', isLoading: false })
      throw err
    }
  },

  deleteProject: async (projectId: string) => {
    try {
      await window.api.deleteProject(projectId)
      const remaining = get().projects.filter((p) => p.id !== projectId)
      const nextActive = remaining.length > 0 ? remaining[0] : null
      set({ projects: remaining, activeProject: nextActive })
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
      set({ stats })
    } catch {
      // Ignore background stats refresh error
    }
  }
}))
