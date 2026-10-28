import React, { useEffect, useState } from 'react'
import { X, FileText, Sparkles, Check, AlertCircle } from 'lucide-react'
import { Project } from '@shared/types'
import { useProjectStore } from '../../stores/project.store'

interface ProjectScriptModalProps {
  isOpen: boolean
  onClose: () => void
  project: Project
  onSaved?: () => Promise<void> | void
}

export function ProjectScriptModal({ isOpen, onClose, project, onSaved }: ProjectScriptModalProps): React.JSX.Element | null {
  const updateProject = useProjectStore((state) => state.updateProject)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description || '')
  const [script, setScript] = useState(project.script || '')
  const [targetPlatform, setTargetPlatform] = useState(project.targetPlatform || 'TikTok')
  const [targetDuration, setTargetDuration] = useState(project.targetDuration ? String(project.targetDuration) : '60')
  const [aspectRatio, setAspectRatio] = useState(project.aspectRatio || '16:9')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    setName(project.name)
    setDescription(project.description || '')
    setScript(project.script || '')
    setTargetPlatform(project.targetPlatform || 'TikTok')
    setTargetDuration(project.targetDuration ? String(project.targetDuration) : '60')
    setAspectRatio(project.aspectRatio || '16:9')
    setError(null)
    setNotice(null)
  }, [project, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    if (!name.trim()) {
      setError('Tên dự án không được để trống.')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      await updateProject(project.id, {
        name: name.trim(),
        description: description.trim(),
        script: script.trim(),
        targetPlatform,
        targetDuration: parseFloat(targetDuration) || 60,
        aspectRatio
      })
      setNotice('Đã lưu kịch bản & thông tin dự án thành công.')
      if (onSaved) await onSaved()
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không lưu được kịch bản.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="script-modal-title"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <h2 id="script-modal-title" className="text-base font-bold text-slate-800">
                Kịch bản & Brief dự án
              </h2>
              <p className="text-xs text-slate-500">
                AI sẽ đối chiếu video gốc (SRC) với kịch bản để chấm điểm mức độ phù hợp phân cảnh.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {error && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700">
              <Check size={16} className="shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tên dự án</label>
            <input
              type="text"
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>

          {/* Script / Storyboard */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                <span>Kịch bản phân cảnh / Nội dung chi tiết (Script)</span>
              </label>
              <span className="text-[11px] text-slate-400">Dùng cho AI chấm điểm độ khớp kịch bản</span>
            </div>
            <textarea
              aria-label="Kịch bản phân cảnh chi tiết"
              disabled={isSubmitting}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={`Ví dụ phân cảnh kịch bản:\nCảnh 1 (00:00 - 00:05): Toàn cảnh khuôn viên trường, góc máy từ trên cao đón bình minh.\nCảnh 2 (00:05 - 00:15): Quang bước vào sảnh chính, camera tracking theo bước chân, nụ cười rạng rỡ.\nCảnh 3 (00:15 - 00:25): Cận cảnh sinh viên thao tác thiết bị trong xưởng thực hành hiện đại.\nCảnh 4 (00:25 - 00:40): Phỏng vấn nhân vật chia sẻ cảm nhận chân thật về đời sống sinh viên.\nCảnh kết: Logo trường và thông điệp tuyển sinh.`}
              rows={8}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 font-mono text-[11px] leading-relaxed focus:outline-none focus:bg-white focus:border-blue-500 transition-all resize-y"
            />
            <p className="mt-1 text-[11px] text-slate-500 leading-normal">
              💡 Khi có kịch bản, <strong>Điểm Biên tập (Editorial)</strong> sẽ đo lường trực tiếp mức độ footage khớp với từng cảnh kịch bản, và AI sẽ gợi ý vị trí dựng phù hợp nhất.
            </p>
          </div>

          {/* Project Goals / Description */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mục tiêu / Định hướng dự án (Brief)</label>
            <textarea
              aria-label="Mục tiêu dự án"
              disabled={isSubmitting}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mục tiêu video, đối tượng khán giả, phong cách, tone & mood..."
              rows={2}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-all resize-none"
            />
          </div>

          {/* Platform, Aspect Ratio, Duration */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nền tảng</label>
              <select
                aria-label="Nền tảng"
                disabled={isSubmitting}
                value={targetPlatform}
                onChange={(e) => setTargetPlatform(e.target.value)}
                className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
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
              <label className="block font-semibold text-slate-700 mb-1">Tỉ lệ</label>
              <select
                aria-label="Tỉ lệ khung hình"
                disabled={isSubmitting}
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
              >
                <option value="16:9">16:9 (Ngang)</option>
                <option value="9:16">9:16 (Dọc)</option>
                <option value="1:1">1:1 (Vuông)</option>
                <option value="4:5">4:5 (Dọc FB)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Thời lượng (giây)</label>
              <input
                aria-label="Thời lượng mục tiêu"
                disabled={isSubmitting}
                type="number"
                min="5"
                max="3600"
                value={targetDuration}
                onChange={(e) => setTargetDuration(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu kịch bản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
