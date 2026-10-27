import React from 'react'
import {
  Folder,
  FileEdit,
  MessageSquare,
  Bot,
  Layers,
  Upload,
  Plus,
  Search,
  Settings
} from 'lucide-react'
import { useProjectStore } from '../../stores/project.store'

interface SidebarProps {
  onOpenCreateProject: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenCreateProject }) => {
  const { projects, activeProject, activeTab, setActiveTab, selectProject } = useProjectStore()

  const navItems = [
    { id: 'overview', label: 'Tổng quan', icon: Folder },
    { id: 'src', label: 'Thư viện SRC', icon: Folder },
    { id: 'versions', label: 'Phiên bản dựng', icon: FileEdit },
    { id: 'review', label: 'Duyệt', icon: MessageSquare },
    { id: 'agent', label: 'Tác nhân', icon: Bot, disabled: true },
    { id: 'memory', label: 'Bộ nhớ', icon: Layers, disabled: true },
    { id: 'export', label: 'Xuất', icon: Upload }
  ] as const

  return (
    <aside className="w-60 h-full bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 select-none text-slate-700">
      {/* Top: Window Dots & Logo & Navigation */}
      <div>
        {/* macOS Window Controls */}
        <div className="h-9 px-5 pt-3.5 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block shadow-sm" />
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block shadow-sm" />
          <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block shadow-sm" />
        </div>

        {/* Brand Logo */}
        <div className="h-14 px-5 flex items-center gap-3">
          <div className="w-7 h-7 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-600 fill-current">
              <rect x="2" y="4" width="20" height="3" rx="1.5" />
              <rect x="5" y="10.5" width="17" height="3" rx="1.5" />
              <rect x="2" y="17" width="14" height="3" rx="1.5" />
            </svg>
          </div>
          <span className="font-bold text-lg text-slate-900 tracking-tight">FrameFlow</span>
        </div>

        {/* Navigation Items */}
        <nav className="px-3 space-y-1 mt-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            const isDisabled = 'disabled' in item && item.disabled

            return (
              <button
                key={item.id}
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-colors duration-150 ${
                  isDisabled
                    ? 'opacity-35 cursor-not-allowed text-slate-400 border-transparent'
                    : isActive
                      ? 'bg-blue-50 text-blue-600 font-semibold border-blue-100 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-blue-600' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Middle/Bottom: Projects Section */}
      <div className="flex-1 flex flex-col justify-end px-3 py-3 border-t border-slate-200 min-h-0">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-xs font-semibold text-slate-500">Dự án</span>
          <button
            type="button"
            title="Tìm kiếm dự án"
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Project List */}
        <div className="overflow-y-auto max-h-48 space-y-1 pr-1 text-xs">
          {projects.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Chưa có dự án nào
            </div>
          ) : (
            projects.map((p) => {
              const isCurrent = activeProject?.id === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProject(p.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left border-l-2 transition-colors duration-150 ${
                    isCurrent
                      ? 'bg-blue-50 text-blue-600 font-medium border-blue-600 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent'
                  }`}
                >
                  <Folder className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="truncate">{p.name}</span>
                </button>
              )
            })
          )}
        </div>

        {/* + Tạo dự án mới */}
        <button
          type="button"
          onClick={onOpenCreateProject}
          className="mt-2.5 flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo dự án mới</span>
        </button>
      </div>

      {/* Bottom Profile Footer */}
      <div className="p-3.5 border-t border-slate-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
            JD
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">Jordan Dell</p>
            <p className="text-[11px] text-slate-500 truncate">jordan@frameflow.co</p>
          </div>
        </div>
        <button
          type="button"
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          title="Cài đặt"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </aside>
  )
}
