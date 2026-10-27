import React, { useEffect, useState } from 'react'
import { Plus, FileVideo, HardDrive, Film, Info } from 'lucide-react'
import { useProjectStore } from '../stores/project.store'
import { SourceAsset } from '@shared/types'

export const SourceLibrary: React.FC = () => {
  const { activeProject, refreshStats } = useProjectStore()
  const [sources, setSources] = useState<SourceAsset[]>([])
  const [selectedAsset, setSelectedAsset] = useState<SourceAsset | null>(null)
  const [isImporting, setIsImporting] = useState(false)

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

      // Create temp video to extract duration & resolution
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

  if (!activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
        Vui lòng chọn hoặc tạo dự án trước.
      </div>
    )
  }

  const totalSizeMB = sources.reduce((acc, s) => acc + (s.fileSize || 0), 0) / (1024 * 1024)

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Thư viện SRC (Source Footage)
            </h1>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span>{sources.length} clips</span>
              <span>•</span>
              <span>{totalSizeMB > 1024 ? `${(totalSizeMB / 1024).toFixed(1)} GB` : `${totalSizeMB.toFixed(1)} MB`}</span>
              <span>•</span>
              <span>Footage gốc từ máy quay</span>
            </div>
          </div>

          <button
            onClick={handleImportSources}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{isImporting ? 'Đang import...' : 'Thêm clip nguồn'}</span>
          </button>
        </div>

        {/* Clips Grid */}
        {sources.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-[#30363d] rounded-xl bg-[#161b22]/50">
            <FileVideo className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-200">Thư viện chưa có footage nào</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Nhấn "Thêm clip nguồn" để chọn các video raw mà cameraman gửi tới.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {sources.map((asset) => {
              const isSelected = selectedAsset?.id === asset.id
              return (
                <div
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className={`bg-[#161b22] border rounded-xl overflow-hidden cursor-pointer transition flex flex-col ${
                    isSelected
                      ? 'border-blue-500 ring-1 ring-blue-500'
                      : 'border-[#21262d] hover:border-slate-600'
                  }`}
                >
                  {/* Thumbnail / Video Preview */}
                  <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                    <video
                      src={`file:///${asset.originalPath.replace(/\\/g, '/')}`}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                    <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/80 rounded text-[10px] font-mono text-white">
                      {Math.floor((asset.duration || 0) / 60)
                        .toString()
                        .padStart(2, '0')}
                      :
                      {Math.round((asset.duration || 0) % 60)
                        .toString()
                        .padStart(2, '0')}
                    </div>
                  </div>

                  {/* Clip Info */}
                  <div className="p-3">
                    <p className="text-xs font-semibold text-white truncate">{asset.filename}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span>{asset.width}x{asset.height}</span>
                      <span>•</span>
                      <span>{((asset.fileSize || 0) / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Right Details Panel */}
      {selectedAsset && (
        <div className="w-80 bg-[#161b22] border-l border-[#21262d] p-5 flex flex-col justify-between overflow-y-auto shrink-0 select-none">
          <div className="space-y-4">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-[#30363d]">
              <video
                src={`file:///${selectedAsset.originalPath.replace(/\\/g, '/')}`}
                className="w-full h-full object-contain"
                controls
              />
            </div>

            <div>
              <h2 className="text-sm font-bold text-white truncate">{selectedAsset.filename}</h2>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5 break-all">
                {selectedAsset.originalPath}
              </p>
            </div>

            {/* Technical Metadata Box */}
            <div className="p-3 bg-[#0d1117] rounded-lg border border-[#21262d] space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Thời lượng</span>
                <span className="font-semibold text-white">
                  {(selectedAsset.duration || 0).toFixed(1)} giây
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Độ phân giải</span>
                <span className="font-semibold text-white">
                  {selectedAsset.width} x {selectedAsset.height}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Tốc độ khung hình</span>
                <span className="font-semibold text-white">{selectedAsset.fps || 30} FPS</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Dung lượng file</span>
                <span className="font-semibold text-white">
                  {((selectedAsset.fileSize || 0) / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Codec</span>
                <span className="font-semibold text-white">{selectedAsset.codec || 'H.264'}</span>
              </div>
            </div>

            {/* AI SRC Intelligence Note */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>SRC Intelligence (Next Phase)</span>
              </div>
              <p className="text-[11px] text-blue-300/80 leading-relaxed">
                Trong giai đoạn tiếp theo, AI sẽ tự động chia đoạn semantic, phát hiện rung/mờ và chấm điểm chất lượng từng giây của clip này.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
