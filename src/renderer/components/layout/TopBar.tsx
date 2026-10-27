import React from 'react'
import { ChevronRight } from 'lucide-react'
import { useProjectStore } from '../../stores/project.store'

export const TopBar: React.FC = () => {
  const { activeProject, activeTab, isLoading, error } = useProjectStore()

  const tabLabels: Record<string, string> = {
    overview: '',
    src: 'Thư viện SRC',
    versions: 'Phiên bản dựng',
    review: 'Duyệt',
    export: 'Xuất'
  }

  const subLabel = tabLabels[activeTab]

  return (
    <header className="h-14 px-8 border-b border-slate-200 flex items-center justify-between shrink-0 select-none bg-white relative">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2.5 text-xs min-w-0">
        <span className="text-slate-400 font-medium">Dự án</span>
        {subLabel && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span className="text-blue-600 font-semibold text-xs whitespace-nowrap">{subLabel}</span>
          </>
        )}
      </div>

      {/* Center Project Name */}
      {activeProject && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center max-w-[35%] truncate pointer-events-none">
          <h1 className="font-bold text-slate-900 text-sm sm:text-base truncate tracking-tight" title={activeProject.name}>
            {activeProject.name}
          </h1>
        </div>
      )}

      {/* Right Actions / Status */}
      <div className="flex items-center gap-3 shrink-0">
        <div id="topbar-actions" className="flex items-center gap-2" />
        {error ? (
          <p role="alert" className="text-xs text-red-600 max-w-md truncate" title={error}>
            {error}
          </p>
        ) : isLoading ? (
          <p role="status" className="text-[11px] text-slate-400">
            Đang tải dự án...
          </p>
        ) : null}
      </div>
    </header>
  )
}
