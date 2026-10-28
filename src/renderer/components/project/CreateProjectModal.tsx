import React, { useState } from 'react'
import { X, Folder, Sparkles, FileUp } from 'lucide-react'
import { useProjectStore } from '../../stores/project.store'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose }) => {
  const { createProject, setActiveTab } = useProjectStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [script, setScript] = useState('')
  const [targetPlatform, setTargetPlatform] = useState('TikTok')
  const [targetDuration, setTargetDuration] = useState('60')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [projectDir, setProjectDir] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isParsingScript, setIsParsingScript] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleImportScriptFile = async () => {
    try {
      setIsParsingScript(true)
      setError(null)
      const parsed = await window.api.selectScriptFile()
      if (!parsed) return
      setScript(parsed.text)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể đọc tệp kịch bản.')
    } finally {
      setIsParsingScript(false)
    }
  }

  if (!isOpen) return null

  const handleSelectDir = async () => {
    try {
      const selected = await window.api.selectDirectory()
      if (selected) {
        setProjectDir(selected)
      }
    } catch (err: any) {
      setError(err.message || 'Không thể chọn thư mục')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    if (!name.trim()) {
      setError('Vui lòng nhập tên dự án')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      await createProject({
        name: name.trim(),
        description: description.trim(),
        script: script.trim() || undefined,
        targetPlatform,
        targetDuration: parseFloat(targetDuration) || 60,
        aspectRatio,
        projectDir: projectDir.trim() || undefined
      })
      setIsSubmitting(false)
      onClose()
      setName('')
      setDescription('')
      setScript('')
      setActiveTab('overview')
    } catch (err: any) {
      setIsSubmitting(false)
      setError(err.message || 'Không thể tạo dự án')
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Tạo dự án" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Tạo dự án mới</h2>
              <p className="text-[11px] text-slate-500">Khởi tạo không gian làm việc cho video review</p>
            </div>
          </div>
          <button
            disabled={isSubmitting}
            aria-label="Đóng tạo dự án"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
              {error}
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tên dự án <span className="text-red-500">*</span>
            </label>
            <input
              aria-label="Tên dự án"
              disabled={isSubmitting}
              maxLength={120}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: UTH Video Giới thiệu"
              className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Mô tả ngắn gọn
            </label>
            <textarea
              aria-label="Mô tả dự án"
              disabled={isSubmitting}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mục tiêu video, thông điệp chính..."
              rows={2}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
            />
          </div>

          {/* Script (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <label className="block text-xs font-semibold text-slate-700">
                Kịch bản phân cảnh (tùy chọn)
              </label>
              <button
                type="button"
                disabled={isSubmitting || isParsingScript}
                onClick={handleImportScriptFile}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title="Hỗ trợ các định dạng: PDF, DOCX, XLSX, TXT, JSON, CSV"
              >
                <FileUp size={12} />
                <span>{isParsingScript ? 'Đang đọc...' : 'Nhập tệp kịch bản (PDF, Word, Excel, TXT, JSON...)'}</span>
              </button>
            </div>
            <textarea
              aria-label="Kịch bản phân cảnh"
              disabled={isSubmitting}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Nhập kịch bản phân cảnh để AI chấm điểm độ phù hợp của clip nguồn với từng cảnh..."
              rows={3}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
            />
          </div>

          {/* Platform & Aspect Ratio */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nền tảng
              </label>
              <select
                aria-label="Nền tảng dự án"
                disabled={isSubmitting}
                value={targetPlatform}
                onChange={(e) => setTargetPlatform(e.target.value)}
                className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
              >
                <option value="Thương hiệu">Thương hiệu</option>
                <option value="TikTok">TikTok</option>
                <option value="Reels">Reels / Shorts</option>
                <option value="YouTube">YouTube 16:9</option>
                <option value="Facebook">Facebook</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tỉ lệ
              </label>
              <select
                aria-label="Tỉ lệ dự án"
                disabled={isSubmitting}
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
              >
                <option value="16:9">16:9 (Ngang)</option>
                <option value="9:16">9:16 (Dọc)</option>
                <option value="1:1">1:1 (Vuông)</option>
                <option value="4:5">4:5 (Dọc FB)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Thời lượng (giây)
              </label>
              <input
                aria-label="Thời lượng mục tiêu"
                disabled={isSubmitting}
                type="number"
                min="5"
                max="3600"
                value={targetDuration}
                onChange={(e) => setTargetDuration(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Custom Directory Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Thư mục lưu trữ (tùy chọn)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={projectDir}
                placeholder="Mặc định: ~/FrameFlowProjects"
                className="flex-1 h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 truncate"
              />
              <button
                disabled={isSubmitting}
                type="button"
                onClick={handleSelectDir}
                className="px-3.5 h-9 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Folder className="w-3.5 h-3.5 text-slate-500" />
                <span>Chọn</span>
              </button>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 h-9 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors shadow-2xs"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 h-9 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Đang tạo...' : 'Tạo dự án'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
