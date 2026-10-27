import React, { useEffect, useRef, useState } from 'react'
import { Annotation, AnnotationType, Point } from '@shared/types'
import { drawAnnotations } from '../../lib/draw-annotations'

interface AnnotationCanvasProps {
  imageSrc: string | null
  annotations: Annotation[]
  onAnnotationsChange?: (annotations: Annotation[]) => void
  currentTool: AnnotationType
  currentColor: string
  strokeWidth: number
  textContent?: string
  readOnly?: boolean
}

export const AnnotationCanvas = React.forwardRef<
  { getAnnotatedBase64: () => string | null }, AnnotationCanvasProps
>(({ imageSrc, annotations, onAnnotationsChange, currentTool, currentColor, strokeWidth, textContent = '', readOnly = false }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const startRef = useRef<Point | null>(null)
  const [preview, setPreview] = useState<Annotation | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [size, setSize] = useState({ width: 960, height: 540 })

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setError('')
    setPreview(null)
    startRef.current = null
    imageRef.current = null
    if (!imageSrc) return
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      imageRef.current = image
      setSize({ width: image.naturalWidth, height: image.naturalHeight })
      setLoaded(true)
    }
    image.onerror = () => { if (!cancelled) setError('Không đọc được ảnh frame. Tệp có thể đã bị di chuyển.') }
    image.src = imageSrc
    return () => { cancelled = true; image.onload = null; image.onerror = null }
  }, [imageSrc])

  const render = (canvas: HTMLCanvasElement, includePreview = false) => {
    const context = canvas.getContext('2d')
    if (!context || !loaded || !imageRef.current) return false
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height)
    drawAnnotations(context, includePreview && preview ? [...annotations, preview] : annotations, canvas.width, canvas.height)
    return true
  }

  useEffect(() => { if (canvasRef.current) render(canvasRef.current, true) }, [loaded, size, annotations, preview])

  React.useImperativeHandle(ref, () => ({
    getAnnotatedBase64: () => {
      if (!loaded || !imageRef.current || startRef.current) return null
      const output = document.createElement('canvas')
      output.width = size.width
      output.height = size.height
      return render(output) ? output.toDataURL('image/png') : null
    }
  }))

  const point = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }
  }
  const shape = (start: Point, end: Point): Annotation => ({
    id: crypto.randomUUID(), reviewCommentId: '', type: currentTool, createdAt: new Date().toISOString(),
    data: {
      type: currentTool, color: currentColor, strokeWidth,
      ...(currentTool === 'ARROW' ? { points: [start.x, start.y, end.x, end.y] }
        : { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) })
    }
  })

  return (
    <div className="space-y-2">
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {!loaded && !error && <p role="status" className="text-xs text-slate-400">Đang tải frame...</p>}
      <canvas ref={canvasRef} width={size.width} height={size.height} aria-label={readOnly ? 'Frame đã lưu cùng annotation' : 'Vẽ annotation lên frame'}
        className={`w-full h-auto bg-black rounded-lg border border-slate-200 touch-none ${readOnly ? '' : 'cursor-crosshair'}`}
        onPointerDown={(event) => {
          if (readOnly || !loaded || event.button !== 0) return
          const start = point(event)
          if (currentTool === 'TEXT') {
            if (!textContent.trim()) return
            onAnnotationsChange?.([...annotations, { id: crypto.randomUUID(), reviewCommentId: '', type: 'TEXT', createdAt: new Date().toISOString(), data: { type: 'TEXT', color: currentColor, strokeWidth, x: start.x, y: start.y, text: textContent.trim(), fontSize: 24 } }])
            return
          }
          startRef.current = start
          event.currentTarget.setPointerCapture(event.pointerId)
          setPreview(shape(start, start))
        }}
        onPointerMove={(event) => { if (startRef.current && !readOnly) setPreview(shape(startRef.current, point(event))) }}
        onPointerUp={(event) => {
          const start = startRef.current
          startRef.current = null
          setPreview(null)
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          if (!start || readOnly) return
          const end = point(event)
          if (Math.hypot(end.x - start.x, end.y - start.y) < 0.005) return
          onAnnotationsChange?.([...annotations, shape(start, end)])
        }}
        onPointerCancel={() => { startRef.current = null; setPreview(null) }}
        onLostPointerCapture={() => { startRef.current = null; setPreview(null) }} />
    </div>
  )
})
