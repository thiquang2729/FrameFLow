import React, { useState } from 'react'
import { X, Folder, Sparkles } from 'lucide-react'
import { useProjectStore } from '../../stores/project.store'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose }) => {
  const { createProject, setActiveTab } = useProjectStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [targetPlatform, setTargetPlatform] = useState('TikTok')
  const [targetDuration, setTargetDuration] = useState('60')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [projectDir, setProjectDir] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSelectDir = async () => {
    try {
      const selected = await window.api.selectDirectory()
      if (selected) {
        setProjectDir(selected)
      }
    } catch (err: any) {
      console.error(err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
        targetPlatform,
        targetDuration: parseFloat(targetDuration) || 60,
        aspectRatio,
        projectDir: projectDir.trim() || undefined
      })
      setIsSubmitting(false)
      onClose()
      setName('')
      setDescription('')
      setActiveTab('overview')
    } catch (err: any) {
      setIsSubmitting(false)
      setError(err.message || 'Không thể tạo dự án')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#21262d]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-semibold text-white">Tạo dự án mới</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Tên dự án <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: UTH Video Giới thiệu"
              className="w-full h-9 px-3 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Mô tả ngắn gọn
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mục tiêu video, thông điệp chính..."
              rows={2}
              className="w-full p-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Platform & Aspect Ratio */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nền tảng
              </label>
              <select
                value={targetPlatform}
                onChange={(e) => setTargetPlatform(e.target.value)}
                className="w-full h-9 px-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="TikTok">TikTok</option>
                <option value="Reels">Reels / Shorts</option>
                <option value="YouTube">YouTube 16:9</option>
                <option value="Facebook">Facebook</option>
                <option value="Other">Khác</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Tỉ lệ
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full h-9 px-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="9:16">9:16 (Dọc)</option>
                <option value="16:9">16:9 (Ngang)</option>
                <option value="1:1">1:1 (Vuông)</option>
                <option value="4:5">4:5 (Dọc FB)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Thời lượng (giây)
              </label>
              <input
                type="number"
                min="5"
                max="3600"
                value={targetDuration}
                onChange={(e) => setTargetDuration(e.target.value)}
                className="w-full h-9 px-3 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Custom Directory Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Thư mục lưu trữ (tùy chọn)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={projectDir}
                placeholder="Mặc định: ~/FrameFlowProjects"
                className="flex-1 h-9 px-3 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-slate-400 truncate"
              />
              <button
                type="button"
                onClick={handleSelectDir}
                className="px-3 h-9 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-[#30363d] rounded-lg text-xs flex items-center gap-1.5 transition"
              >
                <Folder className="w-3.5 h-3.5" />
                <span>Chọn</span>
              </button>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#21262d]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 h-9 bg-transparent hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-lg transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 h-9 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Đang tạo...' : 'Tạo dự án'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
