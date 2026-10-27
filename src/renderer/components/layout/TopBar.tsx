import React from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { useProjectStore } from '../../stores/project.store'

export const TopBar: React.FC = () => {
  const { activeProject, activeTab } = useProjectStore()

  const tabLabels: Record<string, string> = {
    overview: '',
    src: 'Thư viện SRC',
    versions: 'Phiên bản dựng',
    review: 'Duyệt',
    export: 'Xuất'
  }

  const subLabel = tabLabels[activeTab]

  return (
    <header className="h-14 px-8 border-b border-slate-200 flex items-center justify-between shrink-0 select-none bg-white">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2.5 text-xs">
        <span className="text-slate-500 font-medium">Dự án</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className={subLabel ? 'text-slate-700 font-medium' : 'text-blue-600 font-semibold'}>
          {activeProject ? activeProject.name : 'Chọn dự án'}
        </span>
        {subLabel && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-blue-600 font-semibold">{subLabel}</span>
          </>
        )}
      </div>

      {/* Local workspace search */}
      <div className="flex items-center gap-4">
        {/* Search Bar with ⌘ K */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm clip, ghi chú hoặc nội dung khác..."
            className="w-80 h-9 pl-9 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
          <div className="absolute right-3 px-1.5 py-0.5 bg-white border border-slate-200 shadow-2xs rounded text-[10px] text-slate-500 font-mono flex items-center gap-0.5 select-none">
            <span>⌘</span>
            <span>K</span>
          </div>
        </div>

      </div>
    </header>
  )
}
