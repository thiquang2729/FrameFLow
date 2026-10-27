import React, { useEffect, useState } from 'react'
import {
  Folder,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Check,
  Package,
  Send,
  FileText,
  Sliders,
  Lock,
  Image as ImageIcon,
  CheckSquare,
  Square,
  AlertCircle
} from 'lucide-react'
import { useProjectStore } from '../stores/project.store'
import { EditVersion, ReviewComment } from '@shared/types'

interface MockExportComment {
  id: string
  time: string
  title: string
  desc: string
  priority: 'CAO' | 'TRUNG BÌNH' | 'THẤP'
  status: 'ĐANG MỞ' | 'ĐÃ SỬA'
  thumbnail: string
  included: boolean
}

const sampleExportComments: MockExportComment[] = [
  {
    id: 'c1',
    time: '00:12',
    title: 'Phụ đề đang che khuôn mặt',
    desc: 'Có thể hạ phụ đề xuống thấp hơn hoặc dùng kích thước nhỏ hơn không?',
    priority: 'CAO',
    status: 'ĐANG MỞ',
    thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    included: true
  },
  {
    id: 'c2',
    time: '00:28',
    title: 'Cảnh quay hơi tối',
    desc: 'Có thể tăng sáng ở phần này không? Hơi khó nhìn chi tiết.',
    priority: 'CAO',
    status: 'ĐANG MỞ',
    thumbnail: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=200&q=80',
    included: true
  },
  {
    id: 'c3',
    time: '00:35',
    title: 'Zoom quá mạnh',
    desc: 'Tốc độ zoom hơi nhanh, có thể nhẹ nhàng hơn một chút được không? Giữ phông nền ổn định hơn.',
    priority: 'TRUNG BÌNH',
    status: 'ĐANG MỞ',
    thumbnail: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
    included: true
  },
  {
    id: 'c4',
    time: '00:43',
    title: 'Thử phương án khác',
    desc: 'Hãy thử một hiệu ứng chuyển cảnh khác cho đoạn kết. Có thể hiện đại hơn một chút.',
    priority: 'THẤP',
    status: 'ĐANG MỞ',
    thumbnail: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=200&q=80',
    included: true
  }
]

export const ExportPackage: React.FC = () => {
  const { activeProject } = useProjectStore()
  const [commentsList, setCommentsList] = useState<MockExportComment[]>(sampleExportComments)
  const [instructions, setInstructions] = useState(
    'Vui lòng xem xét tất cả các nhận xét có mức độ ưu tiên Cao và Trung bình trong lần chỉnh sửa này. Khắc phục các vấn đề được nêu trong từng nhận xét (vị trí phụ đề, độ sáng, tốc độ zoom, thử hiệu ứng chuyển cảnh khác cho đoạn kết). Giữ nguyên phần nội dung tổng thể, nhịp dựng và thông điệp thương hiệu từ phiên bản trước.'
  )

  const [extraItems, setExtraItems] = useState({
    annotatedFrames: true,
    srcData: true,
    editPreferences: true,
    projectBrief: true,
    lockedSegments: true
  })

  const [isExporting, setIsExporting] = useState(false)
  const [exportedSuccess, setExportedSuccess] = useState(false)

  const toggleComment = (id: string) => {
    setCommentsList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, included: !c.included } : c))
    )
  }

  const selectedCount = commentsList.filter((c) => c.included).length

  const handleExport = async () => {
    if (!activeProject) return
    setIsExporting(true)
    try {
      // Simulate/trigger export package
      await new Promise((r) => setTimeout(r, 1200))
      setIsExporting(false)
      setExportedSuccess(true)
      setTimeout(() => setExportedSuccess(false), 4000)
    } catch (err) {
      setIsExporting(false)
    }
  }

  if (!activeProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#f8fafc]">
        <Folder className="w-12 h-12 text-slate-400 mb-3" />
        <h2 className="text-base font-bold text-slate-800">Chưa chọn dự án</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Chọn một dự án để bắt đầu chuẩn bị gói chỉnh sửa cho AI.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#f8fafc] text-slate-800">
      {/* 1. Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Chuẩn bị gói chỉnh sửa
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Chọn các nhận xét và tài nguyên để gửi cho tác nhân chỉnh sửa AI.
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-2 px-3.5 h-9 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-2xs"
        >
          <BookOpen className="w-3.5 h-3.5 text-slate-500" />
          <span>Tìm hiểu thêm về gói chỉnh sửa</span>
        </button>
      </div>

      {/* 2. Source Version & Target Version Row */}
      <div className="flex items-center gap-4">
        {/* Source Version Card */}
        <div className="flex-1 p-4 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="w-20 h-14 bg-slate-900 rounded-xl overflow-hidden shrink-0 border border-slate-200">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                alt="Source Version"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400">Phiên bản nguồn</p>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5">Draft V2</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">00:48 • 4K • 25 thg 3, 2025</p>
            </div>
          </div>

          <button
            type="button"
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors"
          >
            Thay đổi
          </button>
        </div>

        {/* Transition Arrow */}
        <div className="text-slate-400">
          <ArrowRight className="w-5 h-5" />
        </div>

        {/* Target Version Card */}
        <div className="flex-1 p-4 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="w-20 h-14 bg-slate-900 rounded-xl overflow-hidden shrink-0 border border-slate-200">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                alt="Target Version"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400">Bản chỉnh sửa đích</p>
              <div className="flex items-center gap-2 mt-0.5">
                <h3 className="text-sm font-bold text-slate-900">Draft V3</h3>
                <span className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-600 font-bold border border-blue-200 rounded-md">
                  MỚI NHẤT
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">00:48 • 4K • Dựa trên V2</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Table on Left + Inspector/Preview on Right */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column (8 cols): Feedback Table & Extra Options */}
        <div className="col-span-8 space-y-6">
          {/* Feedback Table Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Nhận xét cần sửa</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chọn các nhận xét cần đưa vào lần chỉnh sửa này. Đã chọn {selectedCount} /{' '}
                  {commentsList.length} nhận xét.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Bộ lọc</span>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 h-8 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-100 transition-colors"
                >
                  <span>Tất cả bình luận</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-200/80 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedCount === commentsList.length}
                        onChange={(e) =>
                          setCommentsList((prev) =>
                            prev.map((c) => ({ ...c, included: e.target.checked }))
                          )
                        }
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="p-3 w-16">ID</th>
                    <th className="p-3 w-20">Thời gian</th>
                    <th className="p-3">Tóm tắt</th>
                    <th className="p-3 w-28">Mức độ ưu tiên</th>
                    <th className="p-3 w-28">Trạng thái</th>
                    <th className="p-3 w-20 text-center">Bao gồm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commentsList.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        item.included ? 'bg-white' : 'bg-slate-50/40 opacity-60'
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.included}
                          onChange={() => toggleComment(item.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-3">
                        <div className="w-12 h-8 rounded-lg overflow-hidden bg-slate-200 border border-slate-300">
                          <img
                            src={item.thumbnail}
                            alt="thumb"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>
                      <td className="p-3 font-mono font-semibold text-slate-700">{item.time}</td>
                      <td className="p-3">
                        <p className="font-bold text-slate-900">{item.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 leading-relaxed">
                          {item.desc}
                        </p>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.priority === 'CAO'
                              ? 'bg-red-50 text-red-600 border border-red-200'
                              : item.priority === 'TRUNG BÌNH'
                                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                : 'bg-blue-50 text-blue-600 border border-blue-200'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-50 text-red-600 border border-red-200">
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {/* iOS style toggle switch */}
                        <button
                          type="button"
                          onClick={() => toggleComment(item.id)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                            item.included ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform ${
                              item.included ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bao gồm thêm (5 Extra Item Cards) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Bao gồm thêm</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chọn các nội dung bổ sung để đưa vào gói chỉnh sửa.
              </p>
            </div>

            <div className="grid grid-cols-5 gap-3 pt-1">
              {/* Option 1: Khung hình có chú thích */}
              <div
                onClick={() =>
                  setExtraItems((prev) => ({
                    ...prev,
                    annotatedFrames: !prev.annotatedFrames
                  }))
                }
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  extraItems.annotatedFrames
                    ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <ImageIcon className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-3">
                  <h4 className="text-xs font-bold text-slate-900">Khung hình có chú thích</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Các khung hình quan trọng kèm ghi chú
                  </p>
                </div>
              </div>

              {/* Option 2: Dữ liệu SRC */}
              <div
                onClick={() =>
                  setExtraItems((prev) => ({
                    ...prev,
                    srcData: !prev.srcData
                  }))
                }
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  extraItems.srcData
                    ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <FileText className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-3">
                  <h4 className="text-xs font-bold text-slate-900">Dữ liệu SRC</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Chi tiết clip và bản ghi chuyển lời
                  </p>
                </div>
              </div>

              {/* Option 3: Tùy chọn dựng */}
              <div
                onClick={() =>
                  setExtraItems((prev) => ({
                    ...prev,
                    editPreferences: !prev.editPreferences
                  }))
                }
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  extraItems.editPreferences
                    ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <Sliders className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-3">
                  <h4 className="text-xs font-bold text-slate-900">Tùy chọn dựng</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Hướng dẫn phong cách và thiết lập kỹ thuật
                  </p>
                </div>
              </div>

              {/* Option 4: Brief dự án */}
              <div
                onClick={() =>
                  setExtraItems((prev) => ({
                    ...prev,
                    projectBrief: !prev.projectBrief
                  }))
                }
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  extraItems.projectBrief
                    ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <FileText className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-3">
                  <h4 className="text-xs font-bold text-slate-900">Brief dự án</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Mục tiêu, đối tượng và thông điệp chính
                  </p>
                </div>
              </div>

              {/* Option 5: Phân đoạn khóa */}
              <div
                onClick={() =>
                  setExtraItems((prev) => ({
                    ...prev,
                    lockedSegments: !prev.lockedSegments
                  }))
                }
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  extraItems.lockedSegments
                    ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-3">
                  <h4 className="text-xs font-bold text-slate-900">Phân đoạn khóa</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Các phân đoạn cần giữ nguyên, không thay đổi
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Hướng dẫn cho tác nhân dựng AI */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Hướng dẫn cho tác nhân dựng AI</h2>
              <span className="text-[11px] font-mono text-slate-400">
                {instructions.length}/2000
              </span>
            </div>
            <p className="text-xs text-slate-500">Cung cấp hướng dẫn rõ ràng cho lần chỉnh sửa này.</p>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-all resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Right Column (4 cols): Xem trước gói (Package Inspector) */}
        <div className="col-span-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex flex-col justify-between h-fit space-y-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Xem trước gói</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Các tệp sau sẽ được đưa vào gói chỉnh sửa.
              </p>
            </div>

            {/* File List */}
            <div className="space-y-2.5">
              {[
                {
                  name: 'README.md',
                  size: '2 KB',
                  desc: 'Hướng dẫn và ngữ cảnh cho tác nhân',
                  isFolder: false
                },
                {
                  name: 'review.json',
                  size: '12 KB',
                  desc: `Các nhận xét đã chọn (${selectedCount})`,
                  isFolder: false
                },
                {
                  name: 'source_library.json',
                  size: '1,8 MB',
                  desc: 'Thông tin nguồn và siêu dữ liệu',
                  isFolder: false
                },
                {
                  name: 'preferences.json',
                  size: '6 KB',
                  desc: 'Tùy chọn dựng và hướng dẫn phong cách',
                  isFolder: false
                },
                {
                  name: 'frames/',
                  size: '8 tệp',
                  desc: 'Khung hình có chú thích',
                  isFolder: true
                },
                {
                  name: 'annotated/',
                  size: '8 tệp',
                  desc: 'Khung hình kèm ghi chú đánh dấu',
                  isFolder: true
                }
              ].map((file, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/70 rounded-xl flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      {file.isFolder ? (
                        <Folder className="w-4 h-4 text-blue-600 fill-blue-600" />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 font-mono truncate">
                        {file.name}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{file.desc}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0 ml-2">
                    {file.size}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            {exportedSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Đã tạo gói chỉnh sửa thành công!</span>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="flex-1 flex items-center justify-center gap-2 h-10 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-2xs"
              >
                <Package className="w-4 h-4 text-slate-500" />
                <span>{isExporting ? 'Đang tạo gói...' : 'Tạo gói chỉnh sửa'}</span>
              </button>

              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="flex-1 flex items-center justify-center gap-2 h-10 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>Gửi cho tác nhân</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
