import React, { useState } from 'react'
import {
  LayoutDashboard,
  Film,
  FileEdit,
  MessageSquare,
  Upload,
  Bot,
  Folder,
  Search,
  Plus
} from 'lucide-react'
import { useProjectStore } from '../../stores/project.store'

interface SidebarProps {
  onOpenCreateProject: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenCreateProject }) => {
  const { projects, activeProject, activeTab, setActiveTab, selectProject } = useProjectStore()
  const [search, setSearch] = useState('')
  const visibleProjects = projects.filter((project) =>
    project.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())
  )

  const navItems = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'src', label: 'Thư viện SRC', icon: Film },
    { id: 'versions', label: 'Phiên bản dựng', icon: FileEdit },
    { id: 'review', label: 'Duyệt', icon: MessageSquare },
    { id: 'export', label: 'Xuất', icon: Upload },
    { id: 'ai', label: 'Kết nối AI', icon: Bot }
  ] as const

  return (
    <aside className="w-64 h-full bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 select-none text-slate-700">
      {/* Top: Brand Header & Navigation */}
      <div>
        {/* Brand Header: Aligned seamlessly with TopBar (h-11, border-b) */}
        <div
          className="h-11 px-4 border-b border-slate-200/90 flex items-center justify-between shrink-0"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600 fill-current">
                <rect x="2" y="4" width="20" height="3" rx="1.5" />
                <rect x="5" y="10.5" width="17" height="3" rx="1.5" />
                <rect x="2" y="17" width="14" height="3" rx="1.5" />
              </svg>
            </div>
            <span className="font-bold text-sm text-slate-900 tracking-tight">FrameFlow</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium border border-slate-200/60">
            v1.1
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-semibold border-blue-100 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-blue-600' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Bottom: Projects Section */}
      <div className="flex-1 flex flex-col justify-end p-3 border-t border-slate-200/90 min-h-0">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dự án</span>
          <span className="text-[10px] font-mono text-slate-400 font-medium">{projects.length}</span>
        </div>

        {/* Search input with icon */}
        <div className="relative mb-2.5">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            aria-label="Tìm dự án"
            placeholder="Tìm dự án..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-lg border border-slate-200/90 bg-slate-50/60 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-300 text-slate-800 placeholder:text-slate-400 transition-colors"
          />
        </div>

        {/* Scrollable Project List */}
        <div className="overflow-y-auto max-h-48 space-y-1 pr-0.5 text-xs">
          {visibleProjects.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-400 border border-dashed border-slate-200/90 rounded-lg">
              {projects.length ? 'Không có dự án phù hợp' : 'Chưa có dự án nào'}
            </div>
          ) : (
            visibleProjects.map((p) => {
              const isCurrent = activeProject?.id === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProject(p.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left border-l-2 transition-colors ${
                    isCurrent
                      ? 'bg-blue-50 text-blue-600 font-medium border-blue-600 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent'
                  }`}
                >
                  <Folder
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isCurrent ? 'text-blue-600' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate flex-1">{p.name}</span>
                </button>
              )
            })
          )}
        </div>

        {/* + Tạo dự án mới Button */}
        <button
          type="button"
          onClick={onOpenCreateProject}
          className="mt-2.5 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-semibold text-blue-600 hover:text-blue-700 shadow-2xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo dự án mới</span>
        </button>
      </div>
    </aside>
  )
}
