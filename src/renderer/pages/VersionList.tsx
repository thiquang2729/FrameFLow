import React, { useEffect, useState } from 'react'
import { Plus, Film, Play, ArrowRight, CheckCircle2, Clock } from 'lucide-react'
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

      // Temporary video element to extract duration & resolution
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
      <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
        Vui lòng chọn hoặc tạo dự án trước.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Quản lý Phiên bản dựng (Versions)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Theo dõi dòng lịch sử (Lineage) từ Draft V1 đến Final. Mỗi feedback luôn gắn chặt với đúng version.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Import bản dựng mới</span>
        </button>
      </div>

      {/* Version Lineage Cards */}
      <div className="space-y-4">
        {versions.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-[#30363d] rounded-xl bg-[#161b22]/50">
            <Film className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-200">Chưa có phiên bản dựng nào</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Hãy import video file đầu tiên (VD: file xuất từ CapCut, Premiere hoặc AI Agent) để bắt đầu.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition"
            >
              Import Draft V1 ngay
            </button>
          </div>
        ) : (
          versions.map((ver, idx) => {
            const isLatest = idx === versions.length - 1
            return (
              <div
                key={ver.id}
                className={`p-5 rounded-xl border transition flex items-center justify-between ${
                  isLatest
                    ? 'bg-[#161b22] border-blue-500/50 shadow-lg shadow-blue-500/5'
                    : 'bg-[#161b22] border-[#21262d] opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-base">
                    V{ver.versionNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">{ver.name}</h3>
                      {isLatest && (
                        <span className="px-2 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 font-bold rounded">
                          PHIÊN BẢN MỚI NHẤT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-mono truncate max-w-lg">
                      {ver.videoPath}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                      <span>{Math.round(ver.duration || 0)}s</span>
                      <span>•</span>
                      <span>{ver.width}x{ver.height}</span>
                      <span>•</span>
                      <span>Tạo ngày {new Date(ver.createdAt).toLocaleDateString('vi-VN')}</span>
                      <span>•</span>
                      <span>Bởi {ver.createdBy}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('review')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-white">Import phiên bản dựng mới</h2>
            <form onSubmit={handleCreateVersion} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Tên phiên bản
                </label>
                <input
                  type="text"
                  required
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  placeholder="VD: Draft V2"
                  className="w-full h-9 px-3 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Chọn Video File (MP4, MOV, WebM) <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    readOnly
                    value={videoPath}
                    placeholder="Chưa chọn file..."
                    className="flex-1 h-9 px-3 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-slate-400 truncate"
                  />
                  <button
                    type="button"
                    onClick={handleSelectVideo}
                    className="px-3 h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition"
                  >
                    Chọn file
                  </button>
                </div>
              </div>

              {versions.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Phiên bản trước (Parent Version)
                  </label>
                  <select
                    value={parentVersionId || ''}
                    onChange={(e) => setParentVersionId(e.target.value || null)}
                    className="w-full h-9 px-3 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Không có (Bản đầu tiên)</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#21262d]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 h-9 text-slate-400 hover:text-white text-xs font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isImporting || !videoPath}
                  className="px-4 h-9 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                >
                  {isImporting ? 'Đang đọc metadata...' : 'Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
