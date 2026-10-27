import React, { useEffect, useState } from 'react'
import {
  FileVideo,
  Film,
  MessageSquare,
  Clock,
  Play,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Target
} from 'lucide-react'
import { useProjectStore } from '../stores/project.store'
import { EditVersion, ReviewComment } from '@shared/types'

export const Dashboard: React.FC = () => {
  const { activeProject, stats, setActiveTab } = useProjectStore()
  const [versions, setVersions] = useState<EditVersion[]>([])
  const [recentComments, setRecentComments] = useState<ReviewComment[]>([])
  const [currentVersion, setCurrentVersion] = useState<EditVersion | null>(null)

  useEffect(() => {
    if (!activeProject) return

    // Load versions
    window.api.listVersions(activeProject.id).then((list: EditVersion[]) => {
      setVersions(list)
      if (list.length > 0) {
        // latest version
        const latest = list[list.length - 1]
        setCurrentVersion(latest)
        // Load comments for latest version
        window.api.listComments(activeProject.id, latest.id).then((comms: ReviewComment[]) => {
          setRecentComments(comms.slice(0, 4))
        })
      } else {
        setCurrentVersion(null)
        setRecentComments([])
      }
    })
  }, [activeProject])

  if (!activeProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <Film className="w-12 h-12 text-slate-600 mb-4" />
        <h2 className="text-lg font-semibold text-slate-200">Chưa chọn dự án</h2>
        <p className="text-sm text-slate-400 mt-1 max-w-sm">
          Hãy chọn một dự án từ danh sách bên trái hoặc tạo dự án mới để bắt đầu.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6">
      {/* Project Header Banner */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {activeProject.name}
          </h1>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
            <span>{activeProject.targetPlatform || 'TikTok'}</span>
            <span>•</span>
            <span>{activeProject.targetDuration || 60}s</span>
            <span>•</span>
            <span>{activeProject.aspectRatio || '9:16'}</span>
            <span>•</span>
            <span>Tạo ngày {new Date(activeProject.createdAt).toLocaleDateString('vi-VN')}</span>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('review')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Mở trong chế độ duyệt</span>
        </button>
      </div>

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Metric 1: SRC Clips */}
        <div className="p-4 bg-[#161b22] border border-[#21262d] rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Tổng số clip SRC</p>
            <p className="text-2xl font-bold text-white mt-1">{stats?.sourceCount || 0}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Footage đã import</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <FileVideo className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Versions */}
        <div className="p-4 bg-[#161b22] border border-[#21262d] rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Phiên bản dựng</p>
            <p className="text-2xl font-bold text-white mt-1">{stats?.versionCount || 0}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {currentVersion ? currentVersion.name : 'Chưa có bản dựng'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Film className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Open Reviews */}
        <div className="p-4 bg-[#161b22] border border-[#21262d] rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Phản hồi đang mở</p>
            <p className="text-2xl font-bold text-white mt-1">{stats?.openReviewCount || 0}</p>
            <p className="text-[10px] text-red-400 mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {stats?.highPriorityCount || 0} ưu tiên cao
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4: Status */}
        <div className="p-4 bg-[#161b22] border border-[#21262d] rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Trạng thái hiện tại</p>
            <p className="text-base font-bold text-blue-400 mt-1 capitalize">
              {activeProject.status.toLowerCase()}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Bản dựng đang được review
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Middle Row: Current Draft + Recent Feedback */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left (7 cols): Current Draft Preview */}
        <div className="col-span-7 bg-[#161b22] border border-[#21262d] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Bản dựng hiện tại</h2>
            <button
              onClick={() => setActiveTab('versions')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <span>Xem tất cả phiên bản</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {currentVersion ? (
            <div className="space-y-4">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-[#30363d] flex items-center justify-center group">
                <video
                  src={`file:///${currentVersion.videoPath.replace(/\\/g, '/')}`}
                  className="w-full h-full object-contain"
                  controls={false}
                />
                <button
                  onClick={() => setActiveTab('review')}
                  className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition"
                >
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">{currentVersion.name}</span>
                    <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 font-semibold rounded">
                      MỚI NHẤT
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {currentVersion.duration ? `${Math.round(currentVersion.duration)}s` : 'Chưa xác định thời lượng'} • {currentVersion.width}x{currentVersion.height} • Tạo bởi {currentVersion.createdBy}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('review')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition flex items-center gap-1.5"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Duyệt bản dựng này</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="aspect-video bg-[#0d1117] border border-dashed border-[#30363d] rounded-lg flex flex-col items-center justify-center p-6 text-center">
              <Film className="w-10 h-10 text-slate-600 mb-2" />
              <p className="text-xs font-medium text-slate-300">Chưa có bản dựng nào</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                Import video đầu tiên (Draft V1) để bắt đầu quy trình review.
              </p>
              <button
                onClick={() => setActiveTab('versions')}
                className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition"
              >
                Import bản dựng V1
              </button>
            </div>
          )}
        </div>

        {/* Right (5 cols): Recent Feedback */}
        <div className="col-span-5 bg-[#161b22] border border-[#21262d] rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Phản hồi gần đây</h2>
            <button
              onClick={() => setActiveTab('review')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto">
            {recentComments.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#30363d] rounded-lg">
                <MessageSquare className="w-7 h-7 text-slate-600 mb-2" />
                <p className="text-xs text-slate-400">Chưa có feedback nào</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Mở chế độ Duyệt để dừng video và tạo comment kèm annotation.
                </p>
              </div>
            ) : (
              recentComments.map((comment) => (
                <div
                  key={comment.id}
                  onClick={() => setActiveTab('review')}
                  className="p-3 bg-[#0d1117] hover:bg-[#1f242c] border border-[#21262d] rounded-lg cursor-pointer transition space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-blue-400">
                      {Math.floor(comment.timestamp / 60)
                        .toString()
                        .padStart(2, '0')}
                      :{(comment.timestamp % 60).toFixed(2).padStart(5, '0')}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 font-semibold rounded ${
                        comment.status === 'FIXED'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {comment.status === 'FIXED' ? 'ĐÃ SỬA' : 'ĐANG MỞ'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                    {comment.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Project Brief & Key Dates */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2 text-white text-sm font-semibold">
            <Target className="w-4 h-4 text-blue-500" />
            <span>Mục tiêu dự án</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {activeProject.description ||
              'Chưa có mô tả mục tiêu dự án. Bạn có thể bổ sung trong phần cài đặt.'}
          </p>
        </div>

        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2 text-white text-sm font-semibold">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span>Thông tin lưu trữ</span>
          </div>
          <p className="text-xs text-slate-400 font-mono truncate">
            {activeProject.projectPath}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            project.db, frames/, annotations/ và exports/ được quản lý tự động.
          </p>
        </div>
      </div>
    </div>
  )
}
