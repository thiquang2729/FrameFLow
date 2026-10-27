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
  fontSize?: number
  setFontSize?: (size: number) => void
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
  fontSize = 24,
  setFontSize,
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

  return (
    <div className="space-y-2 pt-0.5 text-xs select-none">
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
              className={`py-1.5 px-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${
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
          className="py-1.5 px-2 rounded-lg flex flex-col items-center justify-center gap-1 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80 disabled:opacity-40 transition-all"
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
          className="py-1.5 px-2 rounded-lg flex flex-col items-center justify-center gap-1 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80 disabled:opacity-40 transition-all"
          title="Làm lại"
        >
          <Redo2 className="w-4 h-4" />
          <span className="text-[10px] font-medium">Làm lại</span>
        </button>
      </div>

      {/* Colors & Sizes Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        {/* Colors */}
        <div className="flex items-center gap-2">
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

        {/* Stroke / Font Size Slider */}
        <div className="flex items-center gap-2 justify-end">
          <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
            {currentTool === 'TEXT' ? 'Cỡ chữ' : 'Nét'}
          </span>
          <div className="flex items-center gap-2">
            <input
              aria-label={currentTool === 'TEXT' ? 'Kích thước cỡ chữ' : 'Độ dày nét vẽ'}
              type="range"
              min={currentTool === 'TEXT' ? 12 : 1}
              max={currentTool === 'TEXT' ? 72 : 20}
              step="1"
              value={currentTool === 'TEXT' ? fontSize : strokeWidth}
              onChange={(e) => {
                const val = Number(e.target.value)
                if (currentTool === 'TEXT') {
                  setFontSize?.(val)
                } else {
                  setStrokeWidth(val)
                }
              }}
              className="w-24 sm:w-28 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-[11px] font-mono text-slate-500 w-8 text-right select-none">
              {currentTool === 'TEXT' ? fontSize : strokeWidth}px
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
