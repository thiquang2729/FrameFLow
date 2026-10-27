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
    { id: 'overview', label: 'Overview', icon: Folder },
    { id: 'src', label: 'SRC Library', icon: Folder },
    { id: 'versions', label: 'Edit Versions', icon: FileEdit },
    { id: 'review', label: 'Review', icon: MessageSquare },
    { id: 'agent', label: 'Agent', icon: Bot, disabled: true },
    { id: 'memory', label: 'Memory', icon: Layers, disabled: true },
    { id: 'export', label: 'Export', icon: Upload }
  ] as const

  return (
    <aside className="w-60 h-full bg-[#0c1017] border-r border-[#1a2333] flex flex-col justify-between shrink-0 select-none text-slate-300">
      {/* Top: Logo & Main Navigation */}
      <div>
        {/* FrameFlow Brand Logo */}
        <div className="h-16 px-6 flex items-center gap-3">
          {/* Logo Icon (matching mockup: 3 slanted blue bars) */}
          <div className="w-7 h-7 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-500 fill-current">
              <rect x="2" y="4" width="20" height="3" rx="1.5" />
              <rect x="5" y="10.5" width="17" height="3" rx="1.5" />
              <rect x="2" y="17" width="14" height="3" rx="1.5" />
            </svg>
          </div>
          <span className="font-bold text-lg text-white tracking-tight">FrameFlow</span>
        </div>

        {/* Primary Navigation */}
        <nav className="px-3.5 space-y-1 mt-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            const isDisabled = 'disabled' in item && item.disabled

            return (
              <button
                key={item.id}
                disabled={isDisabled}
                onClick={() => !isDisabled && setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isDisabled
                    ? 'opacity-35 cursor-not-allowed text-slate-500'
                    : isActive
                      ? 'bg-[#132a4a] text-blue-400 font-semibold border border-blue-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#141b27]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-blue-400' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Middle/Bottom: Projects Section */}
      <div className="flex-1 flex flex-col justify-end px-3.5 py-3 border-t border-[#1a2333] min-h-0">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-xs font-semibold text-slate-400">Projects</span>
          <button
            title="Search projects"
            className="p-1 text-slate-400 hover:text-slate-200 transition"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Project List */}
        <div className="overflow-y-auto max-h-48 space-y-1 pr-1 text-xs">
          {projects.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-500 border border-dashed border-[#1f293d] rounded-xl">
              No projects yet
            </div>
          ) : (
            projects.map((p) => {
              const isCurrent = activeProject?.id === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => selectProject(p.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                    isCurrent
                      ? 'bg-[#132a4a] text-blue-400 font-medium border-l-2 border-blue-500'
                      : 'text-slate-400 hover:bg-[#141b27] hover:text-slate-200'
                  }`}
                >
                  <Folder className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-blue-400' : 'text-slate-500'}`} />
                  <span className="truncate">{p.name}</span>
                </button>
              )
            })
          )}
        </div>

        {/* + New Project link */}
        <button
          onClick={onOpenCreateProject}
          className="mt-2.5 flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Bottom Profile Footer */}
      <div className="p-3.5 border-t border-[#1a2333] flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#1e2638] border border-[#2d374d] flex items-center justify-center text-xs font-semibold text-slate-300 shrink-0">
            JD
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">Jordan Dell</p>
            <p className="text-[11px] text-slate-500 truncate">jordan@frameflow.co</p>
          </div>
        </div>
        <button
          className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#18202f] transition"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </aside>
  )
}
