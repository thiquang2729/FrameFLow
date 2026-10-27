import React, { useEffect, useState } from 'react'
import { Plus, Film, Play, ArrowRight, CheckCircle2, Clock, Folder, X, Upload } from 'lucide-react'
import { useProjectStore } from '../stores/project.store'
import { CreateVersionDTO, EditVersion } from '@shared/types'

export const VersionList: React.FC = () => {
  const { activeProject, setActiveTab, refreshStats } = useProjectStore()
  const [versions, setVersions] = useState<EditVersion[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [showModal, setShowModal] = useState(false)

  // Form state
  const [versionName, setVersionName] = useState('')
  const [videoPath, setVideoPath] = useState('')
  const [versionNumber, setVersionNumber] = useState(1)
  const [parentVersionId, setParentVersionId] = useState<string | null>(null)

  const loadVersions = async () => {
    if (!activeProject) return
    const list = await window.api.listVersions(activeProject.id)
    setVersions(list)
    setVersionNumber(list.length + 1)
    setVersionName(`Draft V${list.length + 1}`)
    if (list.length > 0) {
      setParentVersionId(list[list.length - 1].id)
    }
  }

  useEffect(() => {
    loadVersions()
  }, [activeProject])

  const handleSelectVideo = async () => {
    const selected = await window.api.selectVideoFile()
    if (selected) {
      setVideoPath(selected)
    }
  }

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProject || !videoPath) return

    try {
      setIsImporting(true)

      const tempVideo = document.createElement('video')
      tempVideo.src = `file:///${videoPath.replace(/\\/g, '/')}`

      await new Promise((resolve) => {
        tempVideo.onloadedmetadata = () => resolve(true)
        tempVideo.onerror = () => resolve(false)
      })

      const duration = tempVideo.duration || 0
      const width = tempVideo.videoWidth || 1920
      const height = tempVideo.videoHeight || 1080

      const dto: CreateVersionDTO = {
        projectId: activeProject.id,
        versionNumber,
        name: versionName || `Draft V${versionNumber}`,
        videoPath,
        parentVersionId: parentVersionId || null,
        duration,
        width,
        height,
        fps: 30,
        createdBy: 'USER'
      }

      await window.api.createVersion(dto)
      await loadVersions()
      await refreshStats()
      setIsImporting(false)
      setShowModal(false)
      setVideoPath('')
    } catch (err) {
      console.error(err)
      setIsImporting(false)
    }
  }

  if (!activeProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#f8fafc]">
        <Folder className="w-12 h-12 text-slate-400 mb-3" />
        <h2 className="text-base font-bold text-slate-800">Chưa chọn dự án</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Chọn một dự án để xem các phiên bản dựng.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#f8fafc] text-slate-800">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Phiên bản dựng
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Theo dõi dòng lịch sử (Lineage) từ Draft V1 đến Final. Mỗi phản hồi gắn chặt với phiên bản tương ứng.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 h-9 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm bản dựng mới</span>
        </button>
      </div>

      {/* Version Lineage Cards */}
      <div className="space-y-3.5">
        {versions.length === 0 ? (
          /* When no version imported yet, show sample cards matching the mockup style */
          [
            {
              id: 'v3',
              name: 'Draft V3',
              versionNumber: 3,
              isLatest: true,
              duration: '00:48',
              res: '4K',
              date: '28 thg 3, 2025, 3:14 CH',
              author: 'Maya Chen',
              desc: 'Đã sửa phụ đề, tăng độ sáng đoạn kết và tinh chỉnh âm thanh.',
              thumb: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
            },
            {
              id: 'v2',
              name: 'Draft V2',
              versionNumber: 2,
              isLatest: false,
              duration: '00:48',
              res: '4K',
              date: '25 thg 3, 2025, 10:20 SA',
              author: 'Jordan Dell',
              desc: 'Bổ sung các đoạn phỏng vấn ngoài trời và đồng bộ nhạc nền.',
              thumb: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=600&q=80'
            },
            {
              id: 'v1',
              name: 'Draft V1',
              versionNumber: 1,
              isLatest: false,
              duration: '00:52',
              res: '4K',
              date: '20 thg 3, 2025, 4:45 CH',
              author: 'Alex Lee',
              desc: 'Bản dựng thô ráp nối toàn bộ kịch bản ban đầu.',
              thumb: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=600&q=80'
            }
          ].map((ver) => (
            <div
              key={ver.id}
              className={`p-4 bg-white border rounded-2xl flex items-center justify-between transition-all hover:shadow-md ${
                ver.isLatest
                  ? 'border-blue-500/80 ring-2 ring-blue-500/10 shadow-sm'
                  : 'border-slate-200/90 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="relative w-28 h-18 bg-slate-900 rounded-xl overflow-hidden shrink-0 border border-slate-200 shadow-2xs">
                  <img src={ver.thumb} alt={ver.name} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono text-white">
                    {ver.duration}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{ver.name}</h3>
                    {ver.isLatest && (
                      <span className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-600 font-bold border border-blue-200 rounded-md">
                        MỚI NHẤT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{ver.desc}</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">
                    {ver.res} • {ver.date} • Chỉnh sửa bởi {ver.author}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('review')}
                  className="flex items-center gap-2 px-3.5 h-9 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Duyệt bản dựng</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          versions.map((ver, idx) => {
            const isLatest = idx === versions.length - 1
            return (
              <div
                key={ver.id}
                className={`p-4 bg-white border rounded-2xl flex items-center justify-between transition-all hover:shadow-md ${
                  isLatest
                    ? 'border-blue-500/80 ring-2 ring-blue-500/10 shadow-sm'
                    : 'border-slate-200/90 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-base shrink-0">
                    V{ver.versionNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{ver.name}</h3>
                      {isLatest && (
                        <span className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-600 font-bold border border-blue-200 rounded-md">
                          MỚI NHẤT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-mono truncate max-w-lg">
                      {ver.videoPath}
                    </p>
                    <div className="flex items-center gap-2.5 mt-1 text-xs text-slate-400">
                      <span>{Math.round(ver.duration || 0)}s</span>
                      <span>•</span>
                      <span>
                        {ver.width}x{ver.height}
                      </span>
                      <span>•</span>
                      <span>Tạo ngày {new Date(ver.createdAt).toLocaleDateString('vi-VN')}</span>
                      <span>•</span>
                      <span>Bởi {ver.createdBy}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('review')}
                    className="flex items-center gap-2 px-3.5 h-9 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Duyệt bản dựng</span>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal Import Version */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900">Import phiên bản dựng mới</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVersion} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Tên phiên bản
                </label>
                <input
                  type="text"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  placeholder="VD: Draft V2"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Tệp video (*.mp4, *.mov)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={videoPath}
                    placeholder="Chưa chọn tệp video"
                    className="flex-1 h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 truncate"
                  />
                  <button
                    type="button"
                    onClick={handleSelectVideo}
                    className="px-3.5 h-9 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium flex items-center gap-1.5 shadow-2xs"
                  >
                    <Folder className="w-3.5 h-3.5 text-slate-500" />
                    <span>Chọn tệp</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 h-9 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-xl transition-colors shadow-2xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!videoPath || isImporting}
                  className="px-4 h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {isImporting ? 'Đang phân tích...' : 'Lưu phiên bản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
