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

      {error ? <p role="alert" className="text-xs text-red-600 max-w-md truncate" title={error}>{error}</p>
        : <p role={isLoading ? 'status' : undefined} className="text-[11px] text-slate-400">{isLoading ? 'Đang tải dự án...' : 'Local · Cá nhân'}</p>}
    </header>
  )
}
