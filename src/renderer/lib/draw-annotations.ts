import { Annotation } from '@shared/types'

// Geometry is normalized to the source frame. Visual sizes use a 960px-wide
// reference so previews and full-resolution PNG exports have the same look.
export function drawAnnotations(context: CanvasRenderingContext2D, annotations: Annotation[], width: number, height: number): void {
  const scale = width / 960
  for (const annotation of annotations) {
    const data = annotation.data
    context.save()
    context.strokeStyle = data.color
    context.fillStyle = data.color
    context.lineWidth = data.strokeWidth * scale
    context.lineCap = 'round'
    if ((annotation.type === 'PEN' || annotation.type === 'HIGHLIGHT') && data.points && data.points.length >= 4) {
      context.lineJoin = 'round'
      if (annotation.type === 'HIGHLIGHT') {
        context.globalAlpha = 0.3
        context.lineWidth = data.strokeWidth * 5 * scale
      }
      context.beginPath()
      context.moveTo(data.points[0] * width, data.points[1] * height)
      for (let index = 2; index < data.points.length; index += 2) context.lineTo(data.points[index] * width, data.points[index + 1] * height)
      context.stroke()
    } else if (annotation.type === 'ARROW' && data.points?.length === 4) {
      const [x1, y1, x2, y2] = data.points
      const sx = x1 * width, sy = y1 * height, ex = x2 * width, ey = y2 * height
      const angle = Math.atan2(ey - sy, ex - sx)
      const head = (12 + data.strokeWidth) * scale
      context.beginPath()
      context.moveTo(sx, sy)
      context.lineTo(ex, ey)
      context.stroke()
      context.beginPath()
      context.moveTo(ex, ey)
      context.lineTo(ex - head * Math.cos(angle - Math.PI / 6), ey - head * Math.sin(angle - Math.PI / 6))
      context.lineTo(ex - head * Math.cos(angle + Math.PI / 6), ey - head * Math.sin(angle + Math.PI / 6))
      context.closePath()
      context.fill()
    } else if (data.x !== undefined && data.y !== undefined) {
      const x = data.x * width, y = data.y * height
      const w = (data.width ?? 0) * width, h = (data.height ?? 0) * height
      if (annotation.type === 'RECT') context.strokeRect(x, y, w, h)
      else if (annotation.type === 'CIRCLE') {
        context.beginPath()
        context.ellipse(x + w / 2, y + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2)
        context.stroke()
      } else if (annotation.type === 'TEXT' && data.text) {
        context.font = `bold ${(data.fontSize ?? 24) * scale}px sans-serif`
        context.textBaseline = 'top'
        context.fillText(data.text, x, y)
      }
    }
    context.restore()
  }
}
