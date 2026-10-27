import React, { useEffect, useState } from 'react'
import {
  Folder,
  Plus,
  Upload,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ChevronDown,
  X,
  Play,
  MoreVertical,
  Copy,
  AlertTriangle,
  Lightbulb,
  Check
} from 'lucide-react'
import { useProjectStore } from '../stores/project.store'
import { SourceAsset } from '@shared/types'

interface MockClip {
  id: string
  name: string
  duration: string
  rating: number
  isRatingHigh: boolean
  tags: { label: string; color: string }[]
  meta: string
  thumbnail: string
  aiSummary: string
  quality: {
    sharpness: number
    stability: number
    exposure: number
    composition: number
    audio: number
    editorialValue: number
  }
  issue: string
  bestUse: string
  aiTags: string[]
}

const sampleClips: MockClip[] = [
  {
    id: 'src-1',
    name: 'SRC_001',
    duration: '00:12',
    rating: 9.1,
    isRatingHigh: true,
    tags: [
      { label: 'Ổn định', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
      { label: 'Phỏng vấn', color: 'bg-blue-50 text-blue-600 border-blue-200' },
      { label: 'Người: Quang', color: 'bg-slate-100 text-slate-600 border-slate-200' }
    ],
    meta: '4K • 384,2 MB • 3 thg 3, 2025',
    thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    aiSummary:
      'Phỏng vấn trung bình với Quang bên ngoài khuôn viên UTH. Hình ảnh tự nhiên, âm thanh rõ ràng và là một phần chân thực về cuộc sống sinh viên và cộng đồng.',
    quality: {
      sharpness: 8.8,
      stability: 9.4,
      exposure: 8.6,
      composition: 9.0,
      audio: 8.9,
      editorialValue: 9.2
    },
    issue: 'Có một chút nhiễu nền (tiếng người nói chuyện). Nên giảm nhẹ tạp âm khi xử lý hậu kỳ.',
    bestUse: 'Phù hợp làm phân đoạn giới thiệu nhân vật. Thích hợp cho phần mở đầu hoặc phần giới thiệu câu chuyện.',
    aiTags: ['Người: Quang', 'Phỏng vấn', 'Ngoài trời', 'Khuôn viên', 'Sinh viên', 'Ánh sáng tự nhiên', 'Đối thoại']
  },
  {
    id: 'src-2',
    name: 'SRC_002',
    duration: '00:08',
    rating: 8.6,
    isRatingHigh: true,
    tags: [
      { label: 'Ổn định', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
      { label: 'B-roll', color: 'bg-blue-50 text-blue-600 border-blue-200' },
      { label: 'Ngoài trời', color: 'bg-slate-100 text-slate-600 border-slate-200' }
    ],
    meta: '4K • 276,1 MB • 3 thg 3, 2025',
    thumbnail: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=600&q=80',
    aiSummary: 'Cảnh sinh viên dạo bước trong khuôn viên nhiều bóng cây. Góc máy mượt mà, màu sắc rực rỡ.',
    quality: {
      sharpness: 9.0,
      stability: 9.2,
      exposure: 8.5,
      composition: 8.8,
      audio: 8.0,
      editorialValue: 8.9
    },
    issue: 'Độ tương phản bóng đổ hơi gắt giữa trưa.',
    bestUse: 'Làm cảnh chuyển nhịp giữa các đoạn phỏng vấn.',
    aiTags: ['B-roll', 'Khuôn viên', 'Ánh sáng tự nhiên', 'Đi bộ']
  },
  {
    id: 'src-3',
    name: 'SRC_003',
    duration: '00:14',
    rating: 8.9,
    isRatingHigh: true,
    tags: [
      { label: 'Ổn định', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
      { label: 'Điện ảnh', color: 'bg-purple-50 text-purple-600 border-purple-200' },
      { label: 'Cảnh mở', color: 'bg-blue-50 text-blue-600 border-blue-200' }
    ],
    meta: '4K • 512,6 MB • 2 thg 3, 2025',
    thumbnail: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=600&q=80',
    aiSummary: 'Góc flycam toàn cảnh trường từ trên cao bao quát tòa nhà chính và cảnh quan đô thị.',
    quality: {
      sharpness: 9.2,
      stability: 9.5,
      exposure: 9.0,
      composition: 9.3,
      audio: 7.0,
      editorialValue: 9.4
    },
    issue: 'Không có âm thanh thu trực tiếp.',
    bestUse: 'Cảnh mở màn hoặc kết thúc video.',
    aiTags: ['Flycam', 'Toàn cảnh', 'Kiến trúc', 'Cảnh mở']
  },
  {
    id: 'src-4',
    name: 'SRC_004',
    duration: '00:32',
    rating: 7.4,
    isRatingHigh: false,
    tags: [
      { label: 'Phỏng vấn', color: 'bg-blue-50 text-blue-600 border-blue-200' },
      { label: 'Người: Quang', color: 'bg-slate-100 text-slate-600 border-slate-200' },
      { label: 'Trong nhà', color: 'bg-slate-100 text-slate-600 border-slate-200' }
    ],
    meta: '4K • 1,1 GB • 2 thg 3, 2025',
    thumbnail: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80',
    aiSummary: 'Phỏng vấn góc cận trong phòng lab.',
    quality: {
      sharpness: 8.0,
      stability: 8.1,
      exposure: 7.2,
      composition: 7.5,
      audio: 8.2,
      editorialValue: 7.4
    },
    issue: 'Ánh sáng phòng lab hơi vàng.',
    bestUse: 'Cắt đoạn chia sẻ về nghiên cứu kỹ thuật.',
    aiTags: ['Phòng lab', 'Trong nhà', 'Đối thoại']
  },
  {
    id: 'src-5',
    name: 'SRC_005',
    duration: '00:08',
    rating: 5.2,
    isRatingHigh: false,
    tags: [
      { label: 'Rung', color: 'bg-red-50 text-red-600 border-red-200' },
      { label: 'B-roll', color: 'bg-blue-50 text-blue-600 border-blue-200' },
      { label: 'Cháy sáng', color: 'bg-orange-50 text-orange-600 border-orange-200' }
    ],
    meta: '4K • 198,4 MB • 2 thg 3, 2025',
    thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=600&q=80',
    aiSummary: 'Quay pan cờ và banner trước cổng.',
    quality: {
      sharpness: 6.0,
      stability: 5.0,
      exposure: 5.2,
      composition: 6.0,
      audio: 6.0,
      editorialValue: 5.2
    },
    issue: 'Bị rung tay mạnh và cháy sáng phần trời.',
    bestUse: 'Hạn chế sử dụng nếu có clip thay thế.',
    aiTags: ['Cổng trường', 'Banner', 'Ngoài trời']
  },
  {
    id: 'src-6',
    name: 'SRC_006',
    duration: '00:10',
    rating: 8.3,
    isRatingHigh: true,
    tags: [
      { label: 'Ổn định', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
      { label: 'Đi bộ', color: 'bg-blue-50 text-blue-600 border-blue-200' },
      { label: 'Nhóm', color: 'bg-slate-100 text-slate-600 border-slate-200' }
    ],
    meta: '4K • 320,5 MB • 2 thg 3, 2025',
    thumbnail: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=600&q=80',
    aiSummary: 'Nhóm 3 sinh viên trò chuyện vui vẻ bước qua sân trường.',
    quality: {
      sharpness: 8.7,
      stability: 8.9,
      exposure: 8.5,
      composition: 8.8,
      audio: 7.5,
      editorialValue: 8.6
    },
    issue: 'Gió nhẹ làm micro hơi rè.',
    bestUse: 'B-roll thể hiện đời sống sinh viên sôi nổi.',
    aiTags: ['Sinh viên', 'Nhóm', 'Đi bộ', 'Sân trường']
  }
]

export const SourceLibrary: React.FC = () => {
  const { activeProject, refreshStats } = useProjectStore()
  const [sources, setSources] = useState<SourceAsset[]>([])
  const [selectedMock, setSelectedMock] = useState<MockClip | null>(sampleClips[0])
  const [selectedAsset, setSelectedAsset] = useState<SourceAsset | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isInspectorOpen, setIsInspectorOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedSummary, setCopiedSummary] = useState(false)

  const loadSources = async () => {
    if (!activeProject) return
    const list = await window.api.listSources(activeProject.id)
    setSources(list)
    if (list.length > 0 && !selectedAsset) {
      setSelectedAsset(list[0])
    }
  }

  useEffect(() => {
    loadSources()
  }, [activeProject])

  const handleImportSources = async () => {
    if (!activeProject) return
    const files = await window.api.selectMediaFiles()
    if (!files || files.length === 0) return

    setIsImporting(true)
    for (const filePath of files) {
      const filename = filePath.split(/[\\/]/).pop() || 'clip.mp4'

      const tempVideo = document.createElement('video')
      tempVideo.src = `file:///${filePath.replace(/\\/g, '/')}`
      await new Promise((resolve) => {
        tempVideo.onloadedmetadata = () => resolve(true)
        tempVideo.onerror = () => resolve(false)
      })

      await window.api.importSource({
        projectId: activeProject.id,
        filePath,
        filename,
        duration: tempVideo.duration || 0,
        width: tempVideo.videoWidth || 1920,
        height: tempVideo.videoHeight || 1080,
        fps: 30,
        codec: 'H.264'
      })
    }

    await loadSources()
    await refreshStats()
    setIsImporting(false)
  }

  const handleCopySummary = () => {
    if (selectedMock?.aiSummary) {
      navigator.clipboard.writeText(selectedMock.aiSummary)
      setCopiedSummary(true)
      setTimeout(() => setCopiedSummary(false), 2000)
    }
  }

  if (!activeProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#f8fafc]">
        <Folder className="w-12 h-12 text-slate-400 mb-3" />
        <h2 className="text-base font-bold text-slate-800">Chưa chọn dự án</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Chọn một dự án để xem thư viện clip nguồn SRC.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-[#f8fafc] text-slate-800">
      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto p-8 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Thư viện SRC</h1>
            <div className="flex items-center gap-2.5 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-slate-400" />
                <span>{activeProject.name}</span>
              </span>
              <span>•</span>
              <span>{sources.length > 0 ? sources.length : 128} clip</span>
              <span>•</span>
              <span>245,6 GB</span>
              <span>•</span>
              <span>Cập nhật 3 thg 3, 2025</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleImportSources}
              className="flex items-center gap-2 px-3.5 h-9 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Nhập tư liệu</span>
            </button>

            <div className="flex items-center rounded-xl bg-blue-600 hover:bg-blue-700 shadow-sm text-white transition-colors overflow-hidden">
              <button
                type="button"
                onClick={handleImportSources}
                disabled={isImporting}
                className="px-3.5 py-2 text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isImporting ? 'Đang nhập...' : 'Thêm clip nguồn'}</span>
              </button>
              <div className="w-[1px] h-4 bg-blue-400/40" />
              <button type="button" className="px-2 py-2 hover:bg-black/10">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm clip nguồn..."
              className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="flex items-center gap-2 px-3 h-9 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 shadow-2xs transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Bộ lọc</span>
            </button>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                className="p-1.5 rounded-lg bg-blue-50 text-blue-600 transition-colors"
                title="Dạng lưới"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                title="Dạng danh sách"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sort Dropdown */}
            <button
              type="button"
              className="flex items-center gap-2 px-3 h-9 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 shadow-2xs transition-colors"
            >
              <span>Sắp xếp: Liên quan</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-600 font-semibold rounded-full shadow-2xs"
            >
              Điểm đánh giá ≥ 8
            </button>
            <button
              type="button"
              className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-full shadow-2xs"
            >
              <span>Ổn định</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            <button
              type="button"
              className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-full shadow-2xs"
            >
              <span>B-roll</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            <button
              type="button"
              className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-full shadow-2xs"
            >
              <span>Ngoài trời</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            <button
              type="button"
              className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-full shadow-2xs"
            >
              <span>Người: Quang</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium ml-1"
            >
              Xóa tất cả
            </button>
          </div>
          <span className="text-slate-400 text-xs font-medium">128 clip</span>
        </div>

        {/* Clips Grid (3 columns) */}
        <div className="grid grid-cols-3 gap-5">
          {sampleClips.map((clip) => {
            const isSelected = selectedMock?.id === clip.id
            return (
              <div
                key={clip.id}
                onClick={() => {
                  setSelectedMock(clip)
                  setIsInspectorOpen(true)
                }}
                className={`bg-white border rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                    : 'border-slate-200/90 shadow-2xs'
                }`}
              >
                {/* Thumbnail Container */}
                <div className="relative aspect-video bg-slate-900 overflow-hidden">
                  <img
                    src={clip.thumbnail}
                    alt={clip.name}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                  {/* Duration Badge */}
                  <span className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/80 backdrop-blur-xs rounded text-[10px] font-mono text-white">
                    {clip.duration}
                  </span>
                  {/* Rating Badge */}
                  <span
                    className={`absolute top-2 right-2 px-2 py-0.5 rounded-lg text-xs font-bold text-white shadow-sm ${
                      clip.rating >= 8
                        ? 'bg-emerald-600'
                        : clip.rating >= 6
                          ? 'bg-amber-600'
                          : 'bg-red-500'
                    }`}
                  >
                    {clip.rating.toFixed(1)}
                  </span>
                </div>

                {/* Card Content */}
                <div className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-900">{clip.name}</h3>
                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {clip.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${t.color}`}
                      >
                        {t.label}
                      </span>
                    ))}
                  </div>

                  {/* Meta */}
                  <p className="text-[11px] text-slate-400 pt-0.5">{clip.meta}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right Inspector Panel */}
      {isInspectorOpen && selectedMock && (
        <aside className="w-96 border-l border-slate-200 bg-white flex flex-col h-full shrink-0 overflow-y-auto">
          {/* Header Preview */}
          <div className="relative aspect-video bg-black shrink-0 group">
            <img
              src={selectedMock.thumbnail}
              alt={selectedMock.name}
              className="w-full h-full object-cover opacity-90"
            />
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsInspectorOpen(false)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            {/* Center Play */}
            <button
              type="button"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 backdrop-blur-xs text-white flex items-center justify-center hover:scale-110 hover:bg-blue-600 transition-all"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </button>
          </div>

          {/* Inspector Details */}
          <div className="p-5 space-y-5 flex-1 text-xs">
            {/* Title & Metadata */}
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">{selectedMock.name}</h2>
                <button type="button" className="text-slate-400 hover:text-slate-600">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
              <p className="text-slate-500 mt-1">{selectedMock.meta}</p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {selectedMock.tags.map((t, idx) => (
                  <span
                    key={idx}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${t.color}`}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            </div>

            {/* AI Summary */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="text-blue-600">✨</span> Tóm tắt AI
                </span>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                  title="Sao chép tóm tắt"
                >
                  {copiedSummary ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                {selectedMock.aiSummary}
              </p>
            </div>

            {/* Quality Score Breakdown */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="text-blue-600">🎯</span> Chất lượng
                </span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 font-bold border border-emerald-200 rounded-md">
                  {selectedMock.rating.toFixed(1)}
                </span>
              </div>

              <div className="space-y-2 pt-1 text-[11px]">
                {[
                  { label: 'Độ sắc nét', val: selectedMock.quality.sharpness },
                  { label: 'Ổn định hình ảnh', val: selectedMock.quality.stability },
                  { label: 'Phơi sáng', val: selectedMock.quality.exposure },
                  { label: 'Bố cục', val: selectedMock.quality.composition },
                  { label: 'Âm thanh', val: selectedMock.quality.audio },
                  { label: 'Giá trị biên tập', val: selectedMock.quality.editorialValue }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3">
                    <span className="text-slate-500 w-28 truncate">{item.label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${(item.val / 10) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-slate-700 w-6 text-right">
                      {item.val.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Issues */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-700">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Vấn đề</span>
              </div>
              <p className="text-slate-600 bg-amber-50/50 p-3 rounded-xl border border-amber-200/60 leading-relaxed">
                {selectedMock.issue}
              </p>
            </div>

            {/* Best Use */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span>Cách dùng tốt nhất</span>
              </div>
              <p className="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/70 leading-relaxed">
                {selectedMock.bestUse}
              </p>
            </div>

            {/* AI Tags */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Thẻ AI</span>
                <button
                  type="button"
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Thêm thẻ</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedMock.aiTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
