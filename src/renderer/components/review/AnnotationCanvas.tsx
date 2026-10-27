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
  fit?: 'preview' | 'player'
}

export const AnnotationCanvas = React.forwardRef<
  { getAnnotatedBase64: () => string | null }, AnnotationCanvasProps
>(({ imageSrc, annotations, onAnnotationsChange, currentTool, currentColor, strokeWidth, textContent = '', readOnly = false, fit = 'preview' }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const startRef = useRef<Point | null>(null)
  const pointsRef = useRef<number[]>([])
  const [preview, setPreview] = useState<Annotation | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [size, setSize] = useState({ width: 960, height: 540 })
  const [viewport, setViewport] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (fit !== 'player' || !containerRef.current) return
    const observer = new ResizeObserver(([entry]) => setViewport({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [fit])

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setError('')
    setPreview(null)
    startRef.current = null
    pointsRef.current = []
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
      ...(currentTool === 'PEN' || currentTool === 'HIGHLIGHT' ? { points: [...pointsRef.current] }
        : currentTool === 'ARROW' ? { points: [start.x, start.y, end.x, end.y] }
        : { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) })
    }
  })

  return (
    <div ref={containerRef} className={fit === 'player' ? 'w-full h-full min-h-0 flex items-center justify-center relative' : 'space-y-2'}>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {!loaded && !error && <p role="status" className="text-xs text-slate-400">Đang tải frame...</p>}
      <canvas ref={canvasRef} width={size.width} height={size.height} aria-label={readOnly ? 'Frame đã lưu cùng annotation' : 'Vẽ annotation lên frame'}
        tabIndex={readOnly ? -1 : 0}
        style={fit === 'player' ? { width: size.width * Math.min(viewport.width / size.width, viewport.height / size.height), height: size.height * Math.min(viewport.width / size.width, viewport.height / size.height) } : undefined}
        className={`block ${fit === 'player' ? '' : 'mx-auto max-w-full max-h-[50vh] w-auto h-auto'} bg-black rounded-lg border border-slate-200 touch-none ${readOnly ? '' : 'cursor-crosshair'}`}
        onPointerDown={(event) => {
          if (readOnly || !loaded || event.button !== 0) return
          event.currentTarget.focus()
          const start = point(event)
          if (currentTool === 'TEXT') {
            if (!textContent.trim()) return
            onAnnotationsChange?.([...annotations, { id: crypto.randomUUID(), reviewCommentId: '', type: 'TEXT', createdAt: new Date().toISOString(), data: { type: 'TEXT', color: currentColor, strokeWidth, x: start.x, y: start.y, text: textContent.trim(), fontSize: 24 } }])
            return
          }
          startRef.current = start
          pointsRef.current = [start.x, start.y, start.x, start.y]
          event.currentTarget.setPointerCapture(event.pointerId)
          setPreview(shape(start, start))
        }}
        onPointerMove={(event) => {
          if (!startRef.current || readOnly) return
          const end = point(event)
          if ((currentTool === 'PEN' || currentTool === 'HIGHLIGHT') && pointsRef.current.length < 4000) pointsRef.current.push(end.x, end.y)
          setPreview(shape(startRef.current, end))
        }}
        onPointerUp={(event) => {
          const start = startRef.current
          startRef.current = null
          setPreview(null)
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          if (!start || readOnly) return
          const end = point(event)
          if (currentTool === 'PEN' || currentTool === 'HIGHLIGHT') pointsRef.current.push(end.x, end.y)
          else if (Math.hypot(end.x - start.x, end.y - start.y) < 0.005) return
          onAnnotationsChange?.([...annotations, shape(start, end)])
        }}
        onPointerCancel={() => { startRef.current = null; setPreview(null) }}
        onLostPointerCapture={() => { startRef.current = null; setPreview(null) }} />
    </div>
  )
})
