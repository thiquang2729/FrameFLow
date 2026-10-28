import React, { useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Film,
  Folder,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { useProjectStore } from '../../stores/project.store'

export const TopBar: React.FC = () => {
  const {
    projects,
    activeProject,
    activeTab,
    isLoading,
    error,
    selectProject
  } = useProjectStore()

  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const tabLabels: Record<string, string> = {
    overview: 'Tổng quan',
    src: 'Thư viện SRC',
    versions: 'Phiên bản dựng',
    review: 'Duyệt',
    export: 'Xuất',
    ai: 'Kết nối AI'
  }

  const currentTabLabel = tabLabels[activeTab] || 'Dự án'

  // Close project switcher dropdown on outside click or Esc
  useEffect(() => {
    if (!projectMenuOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setProjectMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProjectMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [projectMenuOpen])

  return (
    <header
      className="h-11 px-4 border-b border-slate-200/90 flex items-center justify-between shrink-0 select-none bg-white text-slate-800 relative z-30"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: Project Selector & Context Breadcrumb */}
      <div
        className="flex items-center gap-2 text-xs min-w-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Project Switcher Dropdown */}
        <div className="relative" ref={menuRef}>
          {activeProject ? (
            <button
              type="button"
              onClick={() => setProjectMenuOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2 py-1 -ml-1 rounded-md text-xs font-semibold text-slate-900 hover:bg-slate-100 transition-colors border ${
                projectMenuOpen
                  ? 'bg-slate-100 border-slate-300'
                  : 'border-transparent'
              }`}
              title="Đổi dự án"
              aria-haspopup="true"
              aria-expanded={projectMenuOpen}
            >
              <Film className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span className="truncate max-w-[160px] sm:max-w-[220px]">
                {activeProject.name}
              </span>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${
                  projectMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 text-slate-500 font-medium">
              <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Chưa chọn dự án</span>
            </div>
          )}

          {/* Project Switcher Popover Menu */}
          {projectMenuOpen && (
            <div
              className="absolute left-0 top-full mt-1 w-64 bg-white border border-slate-200/90 rounded-lg shadow-lg py-1 z-50 text-xs"
              role="menu"
            >
              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-100">
                Danh sách dự án ({projects.length})
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {projects.map((proj) => {
                  const isCurrent = activeProject?.id === proj.id
                  return (
                    <button
                      key={proj.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        void selectProject(proj.id)
                        setProjectMenuOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                        isCurrent
                          ? 'bg-blue-50/70 text-blue-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate pr-2">{proj.name}</span>
                      {isCurrent && (
                        <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />

        {/* Current Active Workspace Tab */}
        <span className="text-slate-600 font-medium whitespace-nowrap">
          {currentTabLabel}
        </span>

        {/* Project Metadata Badges (High contrast, subtle) */}
        {activeProject?.aspectRatio && (
          <span
            className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-slate-600 bg-slate-100 border border-slate-200/80"
            title="Tỉ lệ video"
          >
            {activeProject.aspectRatio}
          </span>
        )}
      </div>

      {/* Center Flexible Window Drag Area (No colliding absolute elements) */}
      <div className="flex-1 min-w-[16px] h-full" />

      {/* Right: Actions Portal & System Status */}
      <div
        className="flex items-center gap-2.5 shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Dynamic Page Actions Portal */}
        <div id="topbar-actions" className="flex items-center gap-2" />

        {/* Status Indicator */}
        {error ? (
          <div
            role="alert"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 font-medium max-w-xs truncate"
            title={error}
          >
            <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        ) : isLoading ? (
          <div
            role="status"
            className="flex items-center gap-1.5 text-xs text-slate-600 font-medium"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
            <span>Đang tải...</span>
          </div>
        ) : null}
      </div>
    </header>
  )
}

