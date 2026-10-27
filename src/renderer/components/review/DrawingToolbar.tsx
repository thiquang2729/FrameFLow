import React from 'react'
import {
  Pen,
  Highlighter,
  MoveRight,
  Square,
  Circle,
  Type,
  Undo2,
  Redo2
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
  onRedo?: () => void
  canUndo: boolean
  canRedo?: boolean
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  currentTool,
  setCurrentTool,
  currentColor,
  setCurrentColor,
  strokeWidth,
  setStrokeWidth,
  onUndo,
  onRedo,
  canUndo,
  canRedo = false
}) => {
  const tools = [
    { id: 'PEN' as AnnotationType, label: 'Bút tự do', icon: Pen },
    { id: 'ARROW' as AnnotationType, label: 'Mũi tên', icon: MoveRight },
    { id: 'RECT' as AnnotationType, label: 'Hình chữ nhật', icon: Square },
    { id: 'CIRCLE' as AnnotationType, label: 'Hình tròn', icon: Circle },
    { id: 'TEXT' as AnnotationType, label: 'Văn bản', icon: Type },
    { id: 'HIGHLIGHT' as AnnotationType, label: 'Highlight', icon: Highlighter }
  ]

  const colors = [
    '#ef4444', // Red
    '#2563eb', // Blue
    '#10b981', // Green
    '#f59e0b', // Yellow
    '#a855f7', // Purple
    '#ec4899', // Pink
    '#ffffff', // White
    '#0f172a'  // Dark/Black
  ]

  const strokeSizes = [
    { width: 2, label: 'Nhỏ', sizeClass: 'w-2 h-2' },
    { width: 4, label: 'Vừa', sizeClass: 'w-3 h-3' },
    { width: 6, label: 'Lớn', sizeClass: 'w-4 h-4' }
  ]

  return (
    <div className="space-y-3 pt-2 text-xs select-none">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-900 text-xs">Công cụ vẽ</span>
      </div>

      {/* Tool Buttons Row */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-1.5">
        {tools.map((t, idx) => {
          const Icon = t.icon
          const isSelected = currentTool === t.id
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentTool(t.id)}
              className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
              }`}
              title={t.label}
              aria-label={t.label}
              aria-pressed={isSelected}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] truncate max-w-full font-medium">{t.label}</span>
            </button>
          )
        })}

        {/* Undo Button */}
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2 rounded-xl flex flex-col items-center justify-center gap-1 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80 disabled:opacity-40 transition-all"
          title="Hoàn tác"
        >
          <Undo2 className="w-4 h-4" />
          <span className="text-[10px] font-medium">Hoàn tác</span>
        </button>

        {/* Redo Button */}
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="p-2 rounded-xl flex flex-col items-center justify-center gap-1 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80 disabled:opacity-40 transition-all"
          title="Làm lại"
        >
          <Redo2 className="w-4 h-4" />
          <span className="text-[10px] font-medium">Làm lại</span>
        </button>
      </div>

      {/* Colors & Sizes Row */}
      <div className="flex items-center justify-between pt-1">
        {/* Colors */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Màu sắc</span>
          <div className="flex items-center gap-1.5">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Màu ${c}`}
                aria-pressed={currentColor === c}
                onClick={() => setCurrentColor(c)}
                className={`w-5 h-5 rounded-full transition-all border ${
                  c === '#ffffff' ? 'border-slate-300' : 'border-transparent'
                } ${
                  currentColor === c
                    ? 'ring-2 ring-blue-500 ring-offset-1 scale-110 shadow-sm'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Stroke Sizes */}
        <div className="space-y-1.5 text-right">
          <span className="text-[11px] font-semibold text-slate-500">Kích thước</span>
          <div className="flex items-center gap-1.5 justify-end">
            {strokeSizes.map((s) => (
              <button
                key={s.width}
                type="button"
                onClick={() => setStrokeWidth(s.width)}
                className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                  strokeWidth === s.width
                    ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                }`}
                title={s.label}
              >
                <span
                  className={`${s.sizeClass} rounded-full`}
                  style={{ backgroundColor: strokeWidth === s.width ? '#2563eb' : '#64748b' }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
