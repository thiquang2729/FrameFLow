import React, { useEffect, useState } from 'react'
import {
  Folder,
  Film,
  MessageSquare,
  Play,
  ArrowRight,
  MoreVertical,
  Volume2,
  Maximize,
  Target,
  Calendar,
  Users,
  Check,
  FileText,
  Upload,
  ChevronDown,
  Plus
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

    window.api.listVersions(activeProject.id).then((list: EditVersion[]) => {
      setVersions(list)
      if (list.length > 0) {
        const latest = list[list.length - 1]
        setCurrentVersion(latest)
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#f8fafc]">
        <Folder className="w-12 h-12 text-slate-400 mb-3" />
        <h2 className="text-base font-bold text-slate-800">Chưa chọn dự án</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Chọn một dự án từ danh sách bên trái hoặc nhấn "Dự án mới" để bắt đầu.
        </p>
      </div>
    )
  }

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#f8fafc] text-slate-800">
      {/* 1. Project Header Row */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {activeProject.name}
          </h1>
          <div className="flex items-center gap-2.5 text-xs text-slate-500 font-medium">
            <span>{activeProject.targetPlatform || 'Thương hiệu'}</span>
            <span>•</span>
            <span>00:45–{formatTime(activeProject.targetDuration || 60)}</span>
            <span>•</span>
            <span>{activeProject.aspectRatio || '16:9'}</span>
            <span>•</span>
            <span>Tạo ngày {new Date(activeProject.createdAt).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' })}</span>
            <span>•</span>
            <span>Cập nhật 2 giờ trước</span>
          </div>
        </div>

        {/* Right Action Cluster */}
        <div className="flex items-center gap-3">
          {/* Avatar Stack (JD, MK, AL, +) */}
          <div className="flex items-center -space-x-1.5">
            <div className="w-7 h-7 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-2xs">
              JD
            </div>
            <div className="w-7 h-7 rounded-full bg-[#f59e0b] border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-2xs">
              MK
            </div>
            <div className="w-7 h-7 rounded-full bg-slate-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-2xs">
              AL
            </div>
            <div className="w-7 h-7 rounded-full bg-white border border-slate-300 flex items-center justify-center text-xs text-slate-600 shadow-2xs cursor-pointer hover:bg-slate-50 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Chia sẻ Button */}
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className="flex items-center gap-2 px-3.5 h-9 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Chia sẻ</span>
          </button>

          {/* Mở trong chế độ duyệt Button */}
          <button
            type="button"
            onClick={() => setActiveTab('review')}
            className="flex items-center gap-2 px-4 h-9 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Mở trong chế độ duyệt</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 Metric Cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Card 1: Tổng số clip SRC */}
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl flex items-center gap-4 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Tổng số clip SRC</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              {stats?.sourceCount || 128}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Đã thêm 12 clip trong tuần này</p>
          </div>
        </div>

        {/* Card 2: Phiên bản dựng */}
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl flex items-center gap-4 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Phiên bản dựng</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              {stats?.versionCount || (versions.length > 0 ? versions.length : 3)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {currentVersion ? currentVersion.name : 'Bản dựng V3'} mới nhất
            </p>
          </div>
        </div>

        {/* Card 3: Phản hồi đang mở */}
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl flex items-center gap-4 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center text-red-500 shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Phản hồi đang mở</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              {stats?.openReviewCount !== undefined ? stats.openReviewCount : 5}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              <span>{stats?.highPriorityCount || 3} ưu tiên cao</span>
            </p>
          </div>
        </div>

        {/* Card 4: Trạng thái hiện tại */}
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-4">
            {/* Donut progress ring */}
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <svg className="w-6 h-6 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="3"
                  strokeDasharray="88"
                  strokeDashoffset="26"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Trạng thái hiện tại</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">Đang duyệt</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Hạn: 12 thg 4, 2025</p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* 3. Middle Row: Bản dựng hiện tại (7 cols) + Phản hồi gần đây (5 cols) */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left (7 cols): Bản dựng hiện tại Card */}
        <div className="col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">Bản dựng hiện tại</h2>
            <button
              type="button"
              onClick={() => setActiveTab('versions')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5 transition-colors"
            >
              <span>Xem tất cả các phiên bản</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Video Preview Container */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center group shadow-sm">
            {currentVersion ? (
              <video
                src={`file:///${currentVersion.videoPath.replace(/\\/g, '/')}`}
                className="w-full h-full object-cover"
                controls={false}
              />
            ) : (
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80"
                alt="Bản dựng Preview"
                className="w-full h-full object-cover opacity-90"
              />
            )}

            {/* Centered Play Button */}
            <button
              type="button"
              onClick={() => setActiveTab('review')}
              className="absolute w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:bg-blue-600 transition-all"
            >
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </button>

            {/* Video Player Bottom Scrub Bar */}
            <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between text-xs text-white">
              <div className="flex items-center gap-3">
                <Play className="w-3.5 h-3.5 fill-current cursor-pointer" />
                <span className="font-mono text-[11px] text-slate-200">00:00 / 00:48</span>
              </div>
              <div className="flex items-center gap-3 text-slate-200">
                <Volume2 className="w-4 h-4 cursor-pointer hover:text-white" />
                <Maximize className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                <MoreVertical className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
              </div>
            </div>
          </div>

          {/* Draft Metadata & Phát trong chế độ duyệt button */}
          <div className="flex items-center justify-between mt-4 pt-1">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">
                  {currentVersion ? currentVersion.name : 'Bản dựng V3'}
                </span>
                <span className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-600 font-bold border border-blue-200 rounded-md">
                  MỚI NHẤT
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                00:48 • 4K • 28 thg 3, 2025, 3:14 CH • Chỉnh sửa bởi Maya Chen
              </p>
            </div>

            {/* Phát trong chế độ duyệt with split dropdown */}
            <div className="flex items-center rounded-xl bg-blue-600 hover:bg-blue-700 shadow-sm text-white transition-colors overflow-hidden">
              <button
                type="button"
                onClick={() => setActiveTab('review')}
                className="px-3.5 py-2 text-xs font-semibold flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Phát trong chế độ duyệt</span>
              </button>
              <div className="w-[1px] h-4 bg-blue-400/40" />
              <button type="button" className="px-2 py-2 hover:bg-black/10">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right (5 cols): Phản hồi gần đây Card */}
        <div className="col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">Phản hồi gần đây</h2>
            <button
              type="button"
              onClick={() => setActiveTab('review')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5 transition-colors"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Feedback items list (exact match to Vietnamese mockup) */}
          <div className="space-y-3 flex-1 overflow-y-auto">
            {recentComments.length > 0 ? (
              recentComments.map((c) => {
                const isOpen = c.status !== 'FIXED'
                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveTab('review')}
                    className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 rounded-xl cursor-pointer transition-colors flex items-start gap-3 group"
                  >
                    {/* Thumbnail with timestamp badge */}
                    <div className="relative w-16 h-11 bg-slate-200 rounded-lg overflow-hidden shrink-0 border border-slate-300">
                      <div className="w-full h-full bg-slate-300" />
                      <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 rounded text-[9px] font-mono text-white">
                        {formatTime(c.timestamp)}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900 truncate">{c.category}</p>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                            isOpen
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          }`}
                        >
                          {isOpen ? 'ĐANG MỞ' : 'ĐÃ SỬA'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{c.content}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400">
                        <div className="w-3.5 h-3.5 rounded-full bg-slate-400 flex items-center justify-center text-[8px] font-bold text-white">
                          MK
                        </div>
                        <span>Maya Chen • 2 giờ trước</span>
                      </div>
                    </div>

                    <button type="button" className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })
            ) : (
              /* Sample Mockup feedback items when no comments exist yet */
              [
                {
                  id: '1',
                  time: '00:12',
                  title: 'Phụ đề đang che mặt nhân vật',
                  desc: 'Có thể đặt phụ đề xuống thấp hơn hoặc dùng kích thước nhỏ hơn không?',
                  author: 'Maya Chen',
                  ago: '2 giờ trước',
                  status: 'ĐANG MỞ',
                  avatar: 'MK',
                  avatarBg: 'bg-[#c29d72]'
                },
                {
                  id: '2',
                  time: '00:28',
                  title: 'Nhịp cắt hơi chậm',
                  desc: 'Phần này hơi dài một chút. Có thể rút ngắn để nhịp nhanh hơn.',
                  author: 'Jordan Dell',
                  ago: '5 giờ trước',
                  status: 'ĐANG MỞ',
                  avatar: 'JD',
                  avatarBg: 'bg-blue-600'
                },
                {
                  id: '3',
                  time: '00:35',
                  title: 'Cảnh quay quá tối',
                  desc: 'Có thể tăng độ sáng ở phần này không? Nhân vật hơi khó nhìn thấy.',
                  author: 'Alex Lee',
                  ago: '1 ngày trước',
                  status: 'ĐÃ SỬA',
                  avatar: 'AL',
                  avatarBg: 'bg-slate-500'
                },
                {
                  id: '4',
                  time: '00:43',
                  title: 'Logo ở đoạn kết',
                  desc: 'Logo nên to hơn một chút, giữ lâu hơn và thêm chuyển động mượt hơn.',
                  author: 'Maya Chen',
                  ago: '1 ngày trước',
                  status: 'ĐÃ SỬA',
                  avatar: 'MK',
                  avatarBg: 'bg-[#c29d72]'
                }
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => setActiveTab('review')}
                  className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 rounded-xl cursor-pointer transition-colors flex items-start gap-3 group"
                >
                  <div className="relative w-16 h-11 bg-slate-200 rounded-lg overflow-hidden shrink-0 border border-slate-300">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 rounded text-[9px] font-mono text-white">
                      {item.time}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                          item.status === 'ĐANG MỞ'
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.desc}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400">
                      <div className={`w-3.5 h-3.5 rounded-full ${item.avatarBg} flex items-center justify-center text-[8px] font-bold text-white`}>
                        {item.avatar}
                      </div>
                      <span>{item.author} • {item.ago}</span>
                    </div>
                  </div>

                  <button type="button" className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: 3 Cards (Mục tiêu dự án, Mốc thời gian, Nhóm) */}
      <div className="grid grid-cols-3 gap-6">
        {/* Card 1: Mục tiêu dự án */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Target className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Mục tiêu dự án</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {activeProject.description ||
                'Giới thiệu con người, môi trường và tác động của UTH thông qua một video thương hiệu 45–60 giây cho web và mạng xã hội.'}
            </p>
          </div>

          <button
            type="button"
            className="mt-4 w-fit px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Xem brief</span>
          </button>
        </div>

        {/* Card 2: Mốc thời gian */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Mốc thời gian</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Dựng thô</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-700 font-mono text-[11px]">20 thg 3, 2025</span>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Duyệt khách hàng</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-700 font-mono text-[11px]">5 thg 4, 2025</span>
                <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-600 inline-block" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Bàn giao cuối cùng</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-700 font-mono text-[11px]">12 thg 4, 2025</span>
                <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-300 inline-block" />
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Nhóm */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Nhóm</h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[9px] font-bold text-white">
                  JD
                </div>
                <span className="text-xs font-semibold text-slate-800">Jordan Dell</span>
              </div>
              <span className="text-[11px] text-slate-500">Trưởng dự án</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-500 flex items-center justify-center text-[9px] font-bold text-white">
                  AL
                </div>
                <span className="text-xs font-semibold text-slate-800">Alex Lee</span>
              </div>
              <span className="text-[11px] text-slate-500">Nhà sản xuất</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#f59e0b] flex items-center justify-center text-[9px] font-bold text-white">
                  MK
                </div>
                <span className="text-xs font-semibold text-slate-800">Maya Chen</span>
              </div>
              <span className="text-[11px] text-slate-500">Biên tập viên</span>
            </div>
          </div>

          <button
            type="button"
            className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm thành viên</span>
          </button>
        </div>
      </div>
    </div>
  )
}
