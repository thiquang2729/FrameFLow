import React from 'react'
import {
  MoveRight,
  Square,
  Circle,
  Type,
  Undo2,
  Trash2
} from 'lucide-react'
import { AnnotationType } from '@shared/types'

interface DrawingToolbarProps {
  currentTool: AnnotationType
  setCurrentTool: (tool: AnnotationType) => void
  currentColor: string
  setCurrentColor: (color: string) => void
  strokeWidth: number
  setStrokeWidth: (width: number) => void
  onUndo: () => void
  onClear: () => void
  canUndo: boolean
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  currentTool,
  setCurrentTool,
  currentColor,
  setCurrentColor,
  strokeWidth,
  setStrokeWidth,
  onUndo,
  onClear,
  canUndo
}) => {
  const tools: { id: AnnotationType; label: string; icon: any }[] = [
    { id: 'ARROW', label: 'Mũi tên', icon: MoveRight },
    { id: 'RECT', label: 'Hình chữ nhật', icon: Square },
    { id: 'CIRCLE', label: 'Hình tròn', icon: Circle },
    { id: 'TEXT', label: 'Văn bản', icon: Type }
  ]

  const colors = [
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber/Yellow
    '#ec4899', // Pink
    '#ffffff'  // White
  ]

  return (
    <div className="space-y-3 p-3 bg-[#0d1117] border border-[#21262d] rounded-xl text-xs select-none">
      {/* Tool Selection */}
      <div>
        <p className="text-[11px] font-medium text-slate-400 mb-1.5">Công cụ vẽ</p>
        <div className="grid grid-cols-4 gap-1">
          {tools.map((t) => {
            const Icon = t.icon
            const isSelected = currentTool === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setCurrentTool(t.id)}
                title={t.label}
                className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition ${
                  isSelected
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] truncate max-w-full">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Colors & Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-[#21262d]">
        {/* Color Palette */}
        <div className="flex items-center gap-1.5">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrentColor(c)}
              className={`w-5 h-5 rounded-full transition-all ${
                currentColor === c
                  ? 'ring-2 ring-white scale-110 shadow-sm'
                  : 'hover:scale-105 opacity-80 hover:opacity-100'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Undo & Clear */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Hoàn tác (Undo)"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded disabled:opacity-30 transition"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClear}
            title="Xóa tất cả hình vẽ"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
