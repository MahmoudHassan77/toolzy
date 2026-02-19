import { PDFDocument, rgb, StandardFonts, LineCapStyle } from 'pdf-lib'
import {
  Annotation, DrawAnnotation, ShapeAnnotation,
  WhiteoutAnnotation, StampAnnotation,
} from '../../types/pdf'

// ── color helper ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  }
}

// ── SVG path → canvas PNG (for draw annotations) ─────────────────────────────

function drawPathToCanvas(
  svgPath: string, color: string, strokeWidth: number,
  pageWidth: number, pageHeight: number
): string {
  const canvas = document.createElement('canvas')
  canvas.width = pageWidth
  canvas.height = pageHeight
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = color
  ctx.lineWidth = strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const path = new Path2D(svgPath)
  ctx.stroke(path)
  return canvas.toDataURL('image/png')
}

// ── coordinate conversion ─────────────────────────────────────────────────────
// pdfjs: top-left origin  →  pdf-lib: bottom-left origin
// pdfY = pageHeight - screenY / scale

function toDoc(
  screenX: number, screenY: number, scale: number, pageHeight: number
) {
  return { x: screenX / scale, y: pageHeight - screenY / scale }
}

// ── main embed function ───────────────────────────────────────────────────────

export async function embedAnnotations(
  originalBytes: ArrayBuffer,
  annotations: Annotation[],
  pageScales: number[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes)
  const pages = pdfDoc.getPages()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  for (const ann of annotations) {
    const page = pages[ann.pageIndex]
    if (!page) continue
    const { width: pgW, height: pgH } = page.getSize()
    const scale = pageScales[ann.pageIndex] ?? 1.2

    switch (ann.type) {
      case 'highlight': {
        const c = hexToRgb(ann.color)
        const { x, y } = toDoc(ann.x, ann.y + ann.height, scale, pgH)
        page.drawRectangle({
          x, y,
          width: ann.width / scale,
          height: ann.height / scale,
          color: rgb(c.r, c.g, c.b),
          opacity: 0.35,
        })
        break
      }

      case 'whiteout': {
        const w = ann as WhiteoutAnnotation
        const pos = toDoc(w.x, w.y + w.height, scale, pgH)
        page.drawRectangle({
          x: pos.x, y: pos.y,
          width: w.width / scale,
          height: w.height / scale,
          color: rgb(1, 1, 1),
          opacity: 1,
        })
        break
      }

      case 'text': {
        const c = hexToRgb(ann.color)
        const pos = toDoc(ann.x, ann.y + ann.fontSize, scale, pgH)
        page.drawText(ann.text, {
          x: pos.x, y: pos.y,
          size: ann.fontSize / scale,
          font,
          color: rgb(c.r, c.g, c.b),
          lineHeight: ann.fontSize * 1.3 / scale,
        })
        break
      }

      case 'stamp': {
        const s = ann as StampAnnotation
        const c = hexToRgb(s.color)
        const pos = toDoc(s.x, s.y + s.fontSize, scale, pgH)
        // Use helvetica bold equiv (Helvetica is the closest standard font)
        page.drawText(s.text, {
          x: pos.x, y: pos.y,
          size: s.fontSize / scale,
          font,
          color: rgb(c.r, c.g, c.b),
        })
        break
      }

      case 'signature': {
        try {
          const base64 = ann.dataUrl.split(',')[1]
          const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))
          const pngImage = await pdfDoc.embedPng(bytes)
          const pos = toDoc(ann.x, ann.y + ann.height, scale, pgH)
          page.drawImage(pngImage, {
            x: pos.x, y: pos.y,
            width: ann.width / scale,
            height: ann.height / scale,
          })
        } catch (e) {
          console.error('Signature embed failed:', e)
        }
        break
      }

      case 'draw': {
        const d = ann as DrawAnnotation
        // Render the SVG path onto an off-screen canvas → PNG → embed
        const dataUrl = drawPathToCanvas(d.svgPath, d.color, d.strokeWidth / scale, pgW, pgH)
        try {
          const base64 = dataUrl.split(',')[1]
          const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))
          const img = await pdfDoc.embedPng(bytes)
          page.drawImage(img, { x: 0, y: 0, width: pgW, height: pgH, opacity: 1 })
        } catch (e) {
          console.error('Draw embed failed:', e)
        }
        break
      }

      case 'shape': {
        const s = ann as ShapeAnnotation
        const c = hexToRgb(s.color)
        const sw = s.strokeWidth / scale

        if (s.shape === 'rect') {
          const pos = toDoc(s.x, s.y + s.height, scale, pgH)
          page.drawRectangle({
            x: pos.x, y: pos.y,
            width: s.width / scale, height: s.height / scale,
            borderColor: rgb(c.r, c.g, c.b),
            borderWidth: sw,
            color: undefined,
          })
        } else if (s.shape === 'ellipse') {
          const cx = (s.x + s.width / 2) / scale
          const cy = pgH - (s.y + s.height / 2) / scale
          page.drawEllipse({
            x: cx, y: cy,
            xScale: (s.width / 2) / scale,
            yScale: (s.height / 2) / scale,
            borderColor: rgb(c.r, c.g, c.b),
            borderWidth: sw,
            color: undefined,
          })
        } else if (s.shape === 'line' || s.shape === 'arrow') {
          const start = toDoc(s.x, s.y, scale, pgH)
          const end = toDoc(s.x + s.width, s.y + s.height, scale, pgH)
          page.drawLine({
            start, end,
            color: rgb(c.r, c.g, c.b),
            thickness: sw,
            lineCap: LineCapStyle.Round,
          })
          if (s.shape === 'arrow') {
            const angle = Math.atan2(end.y - start.y, end.x - start.x)
            const hl = 12 / scale
            const a1 = angle + Math.PI * 0.75
            const a2 = angle - Math.PI * 0.75
            page.drawLine({
              start: { x: end.x + Math.cos(a1) * hl, y: end.y + Math.sin(a1) * hl },
              end,
              color: rgb(c.r, c.g, c.b), thickness: sw,
            })
            page.drawLine({
              start: { x: end.x + Math.cos(a2) * hl, y: end.y + Math.sin(a2) * hl },
              end,
              color: rgb(c.r, c.g, c.b), thickness: sw,
            })
          }
        }
        break
      }
    }
  }

  return pdfDoc.save()
}
