import React, { useEffect, useState } from 'react'
import { Share2, CheckSquare, Square, FolderCheck, Download, AlertCircle } from 'lucide-react'
import { useProjectStore } from '../stores/project.store'
import { EditVersion, ReviewComment } from '@shared/types'

export const ExportPackage: React.FC = () => {
  const { activeProject } = useProjectStore()
  const [versions, setVersions] = useState<EditVersion[]>([])
  const [sourceVersionId, setSourceVersionId] = useState<string>('')
  const [targetVersionName, setTargetVersionName] = useState('Draft V2')
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [selectedCommentIds, setSelectedCommentIds] = useState<string[]>([])
  const [instructions, setInstructions] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [exportedPath, setExportedPath] = useState<string | null>(null)

  useEffect(() => {
    if (!activeProject) return
    window.api.listVersions(activeProject.id).then((vers: EditVersion[]) => {
      setVersions(vers)
      if (vers.length > 0) {
        const latest = vers[vers.length - 1]
        setSourceVersionId(latest.id)
        setTargetVersionName(`Draft V${latest.versionNumber + 1}`)
      }
    })
  }, [activeProject])

  useEffect(() => {
    if (!activeProject || !sourceVersionId) return
    window.api.listComments(activeProject.id, sourceVersionId).then((comms: ReviewComment[]) => {
      setComments(comms)
      // Default: select all open comments
      setSelectedCommentIds(comms.filter((c: ReviewComment) => c.status !== 'FIXED').map((c: ReviewComment) => c.id))
    })
  }, [activeProject, sourceVersionId])

  const toggleSelectComment = (id: string) => {
    if (selectedCommentIds.includes(id)) {
      setSelectedCommentIds(selectedCommentIds.filter((item) => item !== id))
    } else {
      setSelectedCommentIds([...selectedCommentIds, id])
    }
  }

  const handleExport = async () => {
    if (!activeProject || !sourceVersionId) return
    try {
      setIsExporting(true)
      const pkg = await window.api.createPackage({
        projectId: activeProject.id,
        sourceVersionId,
        targetVersionName,
        commentIds: selectedCommentIds,
        instructions
      })
      setIsExporting(false)
      setExportedPath(pkg.packagePath)
    } catch (err) {
      console.error(err)
      setIsExporting(false)
    }
  }

  if (!activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
        Vui lòng chọn hoặc tạo dự án trước.
      </div>
    )
  }

  const sourceVersion = versions.find((v) => v.id === sourceVersionId)

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Chuẩn bị gói chỉnh sửa (Revision Package)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Đóng gói phản hồi, khung hình kèm hình vẽ chú thích và chỉ dẫn để gửi cho AI Agent / Codex sửa video.
          </p>
        </div>

        {/* Source & Target Version Selection Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-[#161b22] border border-[#21262d] rounded-xl space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Phiên bản nguồn (Source Version)
            </span>
            <select
              value={sourceVersionId}
              onChange={(e) => setSourceVersionId(e.target.value)}
              className="w-full h-9 px-3 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({Math.round(v.duration || 0)}s)
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 bg-[#161b22] border border-[#21262d] rounded-xl space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Bản chỉnh sửa đích (Target Version)
            </span>
            <input
              type="text"
              value={targetVersionName}
              onChange={(e) => setTargetVersionName(e.target.value)}
              placeholder="VD: Draft V3"
              className="w-full h-9 px-3 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Selected Comments Table */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Nhận xét cần sửa ({selectedCommentIds.length} / {comments.length} đã chọn)
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedCommentIds(comments.map((c) => c.id))}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
              >
                Chọn tất cả
              </button>
              <span className="text-slate-600">•</span>
              <button
                onClick={() => setSelectedCommentIds([])}
                className="text-xs text-slate-400 hover:text-slate-300 font-medium"
              >
                Bỏ chọn
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {comments.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-[#21262d] rounded-lg">
                Chưa có phản hồi nào cho phiên bản này.
              </div>
            ) : (
              comments.map((c) => {
                const isSelected = selectedCommentIds.includes(c.id)
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleSelectComment(c.id)}
                    className={`p-3 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#0d1117] border-blue-500/60'
                        : 'bg-[#0d1117]/60 border-[#21262d] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button type="button" className="text-blue-400">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 fill-blue-500/20 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500" />
                        )}
                      </button>

                      <span className="font-mono text-xs font-bold text-blue-400 w-12">
                        {c.id}
                      </span>

                      <span className="font-mono text-xs text-slate-400">
                        {Math.floor(c.timestamp / 60)
                          .toString()
                          .padStart(2, '0')}
                        :{(c.timestamp % 60).toFixed(2).padStart(5, '0')}
                      </span>

                      <p className="text-xs text-slate-200 line-clamp-1 max-w-md">
                        {c.content}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono uppercase">
                        {c.category}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          c.priority === 'HIGH' || c.priority === 'CRITICAL'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {c.priority}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Instructions for Agent */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 space-y-2">
          <label className="block text-xs font-semibold text-white">
            Chỉ dẫn tổng thể cho AI Agent / Editor (Instructions)
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="VD: Vui lòng sửa tất cả các nhận xét ở mức ưu tiên Cao. Giữ nguyên đoạn mở đầu từ 00:00 - 00:05 vì đã được duyệt..."
            rows={3}
            className="w-full p-3 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>
      </div>

      {/* Right Sidebar: Package Preview & Export Action */}
      <div className="w-80 bg-[#161b22] border-l border-[#21262d] p-5 flex flex-col justify-between shrink-0 select-none">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white">Xem trước gói xuất (Preview)</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Các file sau sẽ được tạo tự động bên trong thư mục `exports/` của dự án:
          </p>

          <div className="space-y-2 p-3 bg-[#0d1117] border border-[#21262d] rounded-lg text-xs font-mono">
            <div className="flex items-center justify-between text-slate-300">
              <span>📄 README.md</span>
              <span className="text-slate-500 text-[10px]">Tóm tắt</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>📋 review.json</span>
              <span className="text-blue-400 text-[10px] font-bold">Cốt lõi</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>📝 instructions.md</span>
              <span className="text-slate-500 text-[10px]">Chỉ dẫn</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>📁 frames/</span>
              <span className="text-slate-500 text-[10px]">Ảnh gốc</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>📁 annotated/</span>
              <span className="text-slate-500 text-[10px]">Ảnh có vẽ</span>
            </div>
          </div>

          {exportedPath && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <FolderCheck className="w-4 h-4" />
                <span>Đã xuất thành công!</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono break-all">
                {exportedPath}
              </p>
              <button
                onClick={() => window.api.openPackageFolder(exportedPath)}
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded transition"
              >
                Mở thư mục gói
              </button>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-[#21262d]">
          <button
            onClick={handleExport}
            disabled={isExporting || selectedCommentIds.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Đang tạo gói...' : 'Tạo gói chỉnh sửa'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
