import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Annotation, AnnotationType } from '@shared/types'

interface AnnotationCanvasProps {
  imageSrc: string | null
  annotations: Annotation[]
  onAnnotationsChange?: (newAnnotations: Annotation[]) => void
  currentTool: AnnotationType
  currentColor: string
  strokeWidth: number
  readOnly?: boolean
}

export const AnnotationCanvas = React.forwardRef<
  { getAnnotatedBase64: () => string | null },
  AnnotationCanvasProps
>(({ imageSrc, annotations, onAnnotationsChange, currentTool, currentColor, strokeWidth, readOnly = false }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const imageElementRef = useRef<HTMLImageElement | null>(null)

  // Load image
  useEffect(() => {
    if (!imageSrc) {
      imageElementRef.current = null
      setImageLoaded(false)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageSrc
    img.onload = () => {
      imageElementRef.current = img
      setImageLoaded(true)
    }
  }, [imageSrc])

  // Redraw canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 1. Draw base frame image
    if (imageElementRef.current && imageLoaded) {
      ctx.drawImage(imageElementRef.current, 0, 0, canvas.width, canvas.height)
    } else {
      ctx.fillStyle = '#090d16'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    // Helper to draw an arrow
    const drawArrow = (
      context: CanvasRenderingContext2D,
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      color: string,
      width: number
    ) => {
      const headLength = 14
      const dx = toX - fromX
      const dy = toY - fromY
      const angle = Math.atan2(dy, dx)

      context.save()
      context.strokeStyle = color
      context.fillStyle = color
      context.lineWidth = width
      context.lineCap = 'round'

      // Line
      context.beginPath()
      context.moveTo(fromX, fromY)
      context.lineTo(toX, toY)
      context.stroke()

      // Arrow head
      context.beginPath()
      context.moveTo(toX, toY)
      context.lineTo(
        toX - headLength * Math.cos(angle - Math.PI / 6),
        toY - headLength * Math.sin(angle - Math.PI / 6)
      )
      context.lineTo(
        toX - headLength * Math.cos(angle + Math.PI / 6),
        toY - headLength * Math.sin(angle + Math.PI / 6)
      )
      context.closePath()
      context.fill()
      context.restore()
    }

    // 2. Draw existing annotations
    for (const ann of annotations) {
      const d = ann.data
      ctx.save()
      ctx.strokeStyle = d.color
      ctx.fillStyle = d.color
      ctx.lineWidth = d.strokeWidth || 3

      if (ann.type === 'ARROW' && d.points && d.points.length >= 4) {
        const [x1, y1, x2, y2] = d.points
        drawArrow(
          ctx,
          x1 * canvas.width,
          y1 * canvas.height,
          x2 * canvas.width,
          y2 * canvas.height,
          d.color,
          d.strokeWidth || 3
        )
      } else if (ann.type === 'RECT' && d.x !== undefined && d.y !== undefined) {
        const rx = d.x * canvas.width
        const ry = d.y * canvas.height
        const rw = (d.width || 0.1) * canvas.width
        const rh = (d.height || 0.1) * canvas.height
        ctx.strokeRect(rx, ry, rw, rh)
      } else if (ann.type === 'CIRCLE' && d.x !== undefined && d.y !== undefined) {
        const cx = (d.x + (d.width || 0) / 2) * canvas.width
        const cy = (d.y + (d.height || 0) / 2) * canvas.height
        const rx = Math.abs((d.width || 0.1) * canvas.width) / 2
        const ry = Math.abs((d.height || 0.1) * canvas.height) / 2
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI)
        ctx.stroke()
      } else if (ann.type === 'TEXT' && d.text && d.x !== undefined && d.y !== undefined) {
        ctx.font = 'bold 16px Inter, sans-serif'
        ctx.fillText(d.text, d.x * canvas.width, d.y * canvas.height)
      }
      ctx.restore()
    }

    // 3. Draw in-progress preview while dragging
    if (isDrawing && startPoint && currentPoint && !readOnly) {
      ctx.save()
      ctx.strokeStyle = currentColor
      ctx.fillStyle = currentColor
      ctx.lineWidth = strokeWidth

      const sx = startPoint.x * canvas.width
      const sy = startPoint.y * canvas.height
      const cx = currentPoint.x * canvas.width
      const cy = currentPoint.y * canvas.height

      if (currentTool === 'ARROW') {
        drawArrow(ctx, sx, sy, cx, cy, currentColor, strokeWidth)
      } else if (currentTool === 'RECT') {
        ctx.strokeRect(sx, sy, cx - sx, cy - sy)
      } else if (currentTool === 'CIRCLE') {
        const mx = (sx + cx) / 2
        const my = (sy + cy) / 2
        const rx = Math.abs(cx - sx) / 2
        const ry = Math.abs(cy - sy) / 2
        ctx.beginPath()
        ctx.ellipse(mx, my, rx, ry, 0, 0, 2 * Math.PI)
        ctx.stroke()
      }
      ctx.restore()
    }
  }, [annotations, imageLoaded, isDrawing, startPoint, currentPoint, currentColor, strokeWidth, currentTool, readOnly])

  useEffect(() => {
    redraw()
  }, [redraw])

  // Expose base64 exporter to parent
  React.useImperativeHandle(ref, () => ({
    getAnnotatedBase64: () => {
      const canvas = canvasRef.current
      if (!canvas) return null
      return canvas.toDataURL('image/png')
    }
  }))

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y))
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return
    const pos = getCanvasCoords(e)
    setStartPoint(pos)
    setCurrentPoint(pos)
    setIsDrawing(true)

    if (currentTool === 'TEXT') {
      const text = window.prompt('Nhập nội dung ghi chú text:')
      if (text && text.trim()) {
        const newAnn: Annotation = {
          id: Math.random().toString(),
          reviewCommentId: '',
          type: 'TEXT',
          data: {
            type: 'TEXT',
            color: currentColor,
            strokeWidth,
            x: pos.x,
            y: pos.y,
            text: text.trim()
          },
          createdAt: new Date().toISOString()
        }
        onAnnotationsChange?.([...annotations, newAnn])
      }
      setIsDrawing(false)
      setStartPoint(null)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || readOnly) return
    const pos = getCanvasCoords(e)
    setCurrentPoint(pos)
  }

  const handleMouseUp = () => {
    if (!isDrawing || !startPoint || !currentPoint || readOnly) {
      setIsDrawing(false)
      return
    }

    if (currentTool === 'ARROW') {
      const newAnn: Annotation = {
        id: Math.random().toString(),
        reviewCommentId: '',
        type: 'ARROW',
        data: {
          type: 'ARROW',
          color: currentColor,
          strokeWidth,
          points: [startPoint.x, startPoint.y, currentPoint.x, currentPoint.y]
        },
        createdAt: new Date().toISOString()
      }
      onAnnotationsChange?.([...annotations, newAnn])
    } else if (currentTool === 'RECT' || currentTool === 'CIRCLE') {
      const x = Math.min(startPoint.x, currentPoint.x)
      const y = Math.min(startPoint.y, currentPoint.y)
      const width = Math.abs(currentPoint.x - startPoint.x)
      const height = Math.abs(currentPoint.y - startPoint.y)

      if (width > 0.01 && height > 0.01) {
        const newAnn: Annotation = {
          id: Math.random().toString(),
          reviewCommentId: '',
          type: currentTool,
          data: {
            type: currentTool,
            color: currentColor,
            strokeWidth,
            x,
            y,
            width,
            height
          },
          createdAt: new Date().toISOString()
        }
        onAnnotationsChange?.([...annotations, newAnn])
      }
    }

    setIsDrawing(false)
    setStartPoint(null)
    setCurrentPoint(null)
  }

  return (
    <div ref={containerRef} className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-[#30363d]">
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`w-full h-full ${readOnly ? 'cursor-default' : 'cursor-crosshair'}`}
      />
    </div>
  )
})
