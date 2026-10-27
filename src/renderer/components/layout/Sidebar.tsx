import React from 'react'
import {
  LayoutDashboard,
  FileVideo,
  Film,
  MessageSquare,
  Bot,
  BrainCircuit,
  Share2,
  Plus,
  FolderOpen,
  Settings
} from 'lucide-react'
import { useProjectStore } from '../../stores/project.store'

interface SidebarProps {
  onOpenCreateProject: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenCreateProject }) => {
  const { projects, activeProject, activeTab, setActiveTab, selectProject } = useProjectStore()

  const navItems = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'src', label: 'Thư viện SRC', icon: FileVideo },
    { id: 'versions', label: 'Phiên bản dựng', icon: Film },
    { id: 'review', label: 'Duyệt (Review)', icon: MessageSquare, highlight: true },
    { id: 'agent', label: 'Tác nhân AI', icon: Bot, disabled: true, tag: 'Next' },
    { id: 'memory', label: 'Bộ nhớ (Memory)', icon: BrainCircuit, disabled: true, tag: 'Next' },
    { id: 'export', label: 'Xuất dự án', icon: Share2 }
  ] as const

  return (
    <aside className="w-64 h-full bg-[#12161f] border-r border-[#21262d] flex flex-col justify-between shrink-0 select-none">
      {/* Top: Logo & Main Nav */}
      <div className="flex flex-col">
        {/* Logo */}
        <div className="h-14 px-5 flex items-center gap-3 border-b border-[#21262d]">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight">FrameFlow</span>
            <span className="ml-1 text-[10px] uppercase font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
              v0.1
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            const isDisabled = 'disabled' in item && item.disabled

            return (
              <button
                key={item.id}
                disabled={isDisabled}
                onClick={() => !isDisabled && setActiveTab(item.id as any)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isDisabled
                    ? 'opacity-40 cursor-not-allowed text-slate-500'
                    : isActive
                      ? 'bg-blue-600/15 text-blue-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-blue-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {'tag' in item && item.tag && (
                  <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                    {item.tag}
                  </span>
                )}
                {'highlight' in item && item.highlight && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Middle/Bottom: Projects List */}
      <div className="flex-1 flex flex-col justify-end px-3 py-2 border-t border-[#21262d] min-h-0">
        <div className="flex items-center justify-between px-2 mb-1.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Dự án ({projects.length})
          </span>
          <button
            onClick={onOpenCreateProject}
            title="Tạo dự án mới"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Project List */}
        <div className="overflow-y-auto max-h-40 space-y-0.5 pr-1 text-sm">
          {projects.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-500 border border-dashed border-[#30363d] rounded-lg">
              Chưa có dự án nào
            </div>
          ) : (
            projects.map((p) => {
              const isCurrent = activeProject?.id === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => selectProject(p.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left text-xs transition ${
                    isCurrent
                      ? 'bg-blue-600 text-white font-medium shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-white' : 'text-slate-500'}`} />
                  <span className="truncate">{p.name}</span>
                </button>
              )
            })
          )}
        </div>

        {/* New project quick trigger */}
        <button
          onClick={onOpenCreateProject}
          className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-blue-500/20 rounded-lg transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tạo dự án mới</span>
        </button>
      </div>

      {/* Bottom: User / Workspace info */}
      <div className="p-3 border-t border-[#21262d] flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            FF
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">FrameFlow Local</p>
            <p className="text-[10px] text-slate-500 truncate">Workspace V0.1</p>
          </div>
        </div>
        <button
          className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition"
          title="Cài đặt"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </aside>
  )
}
