import React from 'react'
import {
  Pen,
  Highlighter,
  MoveRight,
  Square,
  Circle,
  Type,
  Undo2,
  Redo2,
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
  fontSize?: number
  setFontSize?: (size: number) => void
  onUndo: () => void
  onRedo?: () => void
  canUndo: boolean
  canRedo?: boolean
  onClearAll?: () => void
  canClear?: boolean
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
  canRedo = false,
  onClearAll,
  canClear = false
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
    <div className="flex items-center gap-2 sm:gap-3 text-xs select-none flex-nowrap overflow-x-auto min-w-0 py-0.5">
      {/* Tool Buttons */}
      <div className="flex items-center gap-1 shrink-0 flex-nowrap">
        {tools.map((t) => {
          const Icon = t.icon
          const isSelected = currentTool === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setCurrentTool(t.id)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
              }`}
              title={t.label}
              aria-label={t.label}
              aria-pressed={isSelected}
            >
              <Icon className="w-4 h-4" />
            </button>
          )
        })}

        <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

        {/* Undo Button */}
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80 disabled:opacity-40 transition-all shrink-0"
          title="Hoàn tác"
          aria-label="Hoàn tác"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        {/* Redo Button */}
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80 disabled:opacity-40 transition-all shrink-0"
          title="Làm lại"
          aria-label="Làm lại"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        {onClearAll && (
          <button
            type="button"
            onClick={onClearAll}
            disabled={!canClear}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-red-600 border border-slate-200/80 disabled:opacity-40 transition-all shrink-0"
            title="Xóa tất cả hình vẽ"
            aria-label="Xóa tất cả hình vẽ"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="h-4 w-px bg-slate-200 shrink-0 mx-1" />

      {/* Colors */}
      <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Màu ${c}`}
            aria-pressed={currentColor === c}
            onClick={() => setCurrentColor(c)}
            className={`w-5 h-5 rounded-full transition-all border shrink-0 ${
              c === '#ffffff' ? 'border-slate-300' : 'border-transparent'
            } ${
              currentColor === c
                ? 'ring-2 ring-blue-500 ring-offset-1 scale-110 shadow-xs'
                : 'hover:scale-110'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="h-4 w-px bg-slate-200 shrink-0 mx-1" />

      {/* Stroke / Font Size Slider */}
      <div className="flex items-center gap-2 shrink-0 flex-nowrap">
        <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
          {currentTool === 'TEXT' ? 'Cỡ chữ' : 'Nét'}
        </span>
        <div className="flex items-center gap-1.5">
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
            className="w-20 sm:w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 shrink-0"
          />
          <span className="text-[11px] font-mono text-slate-500 w-7 text-right select-none shrink-0">
            {currentTool === 'TEXT' ? fontSize : strokeWidth}px
          </span>
        </div>
      </div>
    </div>
  )
}
