import React from 'react'
import { ChevronRight, Search, Bell } from 'lucide-react'
import { useProjectStore } from '../../stores/project.store'

export const TopBar: React.FC = () => {
  const { activeProject } = useProjectStore()

  return (
    <header className="h-14 px-8 border-b border-[#1a2333] flex items-center justify-between shrink-0 select-none bg-[#0c1017]">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2.5 text-xs">
        <span className="text-slate-400 font-medium">Projects</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-blue-400 font-semibold">
          {activeProject ? activeProject.name : 'Select a project'}
        </span>
      </div>

      {/* Right Controls: Search bar + Notification Bell */}
      <div className="flex items-center gap-4">
        {/* Search Bar with ⌘ K */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search clips, notes, or anything..."
            className="w-80 h-9 pl-9 pr-12 bg-[#131923] border border-[#1f293d] rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
          <div className="absolute right-3 px-1.5 py-0.5 bg-[#1b2333] border border-[#2a364e] rounded text-[10px] text-slate-400 font-mono flex items-center gap-0.5">
            <span>⌘</span>
            <span>K</span>
          </div>
        </div>

        {/* Notification Bell */}
        <button
          className="relative p-2 text-slate-400 hover:text-slate-200 hover:bg-[#131923] rounded-xl transition"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#0c1017]" />
        </button>
      </div>
    </header>
  )
}
