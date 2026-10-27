import React from 'react'
import {
  ChevronRight,
  Search,
  Share2,
  Play
} from 'lucide-react'
import { useProjectStore } from '../../stores/project.store'

export const TopBar: React.FC = () => {
  const { activeProject, activeTab, setActiveTab } = useProjectStore()

  const tabLabels: Record<string, string> = {
    overview: 'Tổng quan',
    src: 'Thư viện SRC',
    versions: 'Phiên bản dựng',
    review: 'Duyệt (Review Workspace)',
    export: 'Xuất gói chỉnh sửa'
  }

  return (
    <header className="h-14 px-6 bg-[#161b22] border-b border-[#21262d] flex items-center justify-between shrink-0 select-none">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400">Dự án</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="font-semibold text-slate-200">
          {activeProject ? activeProject.name : 'Chưa chọn dự án'}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-blue-400 font-medium">
          {tabLabels[activeTab] || activeTab}
        </span>
      </div>

      {/* Right controls: Search & Quick actions */}
      <div className="flex items-center gap-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm clip, ghi chú..."
            className="w-56 h-8 pl-8 pr-3 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Action Button */}
        {activeTab !== 'review' ? (
          <button
            onClick={() => setActiveTab('review')}
            className="flex items-center gap-2 px-3 h-8 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Mở chế độ duyệt</span>
          </button>
        ) : (
          <button
            onClick={() => setActiveTab('export')}
            className="flex items-center gap-2 px-3 h-8 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Xuất phản hồi</span>
          </button>
        )}
      </div>
    </header>
  )
}
