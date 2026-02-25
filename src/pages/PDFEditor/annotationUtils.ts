import { PDFDocument, rgb, degrees, StandardFonts, LineCapStyle } from 'pdf-lib'
import {
  Annotation, DrawAnnotation, ShapeAnnotation,
  WhiteoutAnnotation, StampAnnotation, StickyNoteAnnotation, HighlightAnnotation,
  PolygonAnnotation, CalloutAnnotation,
  PageOp,
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
  pageScales: number[],
  pageOperations: PageOp[] = []
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes)

  // ── Apply page operations IN ORDER ──────────────────────────────────────
  for (const op of pageOperations) {
    const pages = pdfDoc.getPages()
    switch (op.type) {
      case 'rotate': {
        const page = pages[op.pageIndex]
        if (page) {
          const currentRotation = page.getRotation().angle
          page.setRotation(degrees(currentRotation + op.degrees))
        }
        break
      }
      case 'delete': {
        if (op.pageIndex >= 0 && op.pageIndex < pages.length && pages.length > 1) {
          pdfDoc.removePage(op.pageIndex)
        }
        break
      }
      case 'move': {
        if (op.from >= 0 && op.from < pages.length && op.to >= 0 && op.to < pages.length && op.from !== op.to) {
          // pdf-lib doesn't have a native movePage, so we copy and reinsert
          // We remove the page and insert it at the new position
          const [movedPage] = await pdfDoc.copyPages(pdfDoc, [op.from])
          pdfDoc.removePage(op.from)
          pdfDoc.insertPage(op.to, movedPage)
        }
        break
      }
    }
  }

  const pages = pdfDoc.getPages()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  for (const ann of annotations) {
    const page = pages[ann.pageIndex]
    if (!page) continue
    const { width: pgW, height: pgH } = page.getSize()
    const scale = pageScales[ann.pageIndex] ?? 1.2

    switch (ann.type) {
      case 'highlight': {
        const ha = ann as HighlightAnnotation
        const c = hexToRgb(ha.color)
        const style = ha.markupStyle ?? 'highlight'
        const annOpacity = ha.opacity ?? 0.35

        if (style === 'underline') {
          // Draw a line at the bottom of the rect area
          const startPos = toDoc(ha.x, ha.y + ha.height, scale, pgH)
          const endPos = toDoc(ha.x + ha.width, ha.y + ha.height, scale, pgH)
          page.drawLine({
            start: { x: startPos.x, y: startPos.y },
            end: { x: endPos.x, y: endPos.y },
            color: rgb(c.r, c.g, c.b),
            thickness: 2 / scale,
            opacity: annOpacity,
          })
        } else if (style === 'strikethrough') {
          // Draw a line at the middle of the rect area
          const midY = ha.y + ha.height / 2
          const startPos = toDoc(ha.x, midY, scale, pgH)
          const endPos = toDoc(ha.x + ha.width, midY, scale, pgH)
          page.drawLine({
            start: { x: startPos.x, y: startPos.y },
            end: { x: endPos.x, y: endPos.y },
            color: rgb(c.r, c.g, c.b),
            thickness: 2 / scale,
            opacity: annOpacity,
          })
        } else {
          // Default highlight rectangle
          const { x, y } = toDoc(ha.x, ha.y + ha.height, scale, pgH)
          page.drawRectangle({
            x, y,
            width: ha.width / scale,
            height: ha.height / scale,
            color: rgb(c.r, c.g, c.b),
            opacity: annOpacity,
          })
        }
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
          page.drawImage(img, { x: 0, y: 0, width: pgW, height: pgH, opacity: d.opacity ?? 1 })
        } catch (e) {
          console.error('Draw embed failed:', e)
        }
        break
      }

      case 'shape': {
        const s = ann as ShapeAnnotation
        const c = hexToRgb(s.color)
        const sw = s.strokeWidth / scale
        const shapeOpacity = s.opacity ?? 1

        if (s.shape === 'rect') {
          const pos = toDoc(s.x, s.y + s.height, scale, pgH)
          page.drawRectangle({
            x: pos.x, y: pos.y,
            width: s.width / scale, height: s.height / scale,
            borderColor: rgb(c.r, c.g, c.b),
            borderWidth: sw,
            color: undefined,
            opacity: shapeOpacity,
            borderOpacity: shapeOpacity,
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
            opacity: shapeOpacity,
            borderOpacity: shapeOpacity,
          })
        } else if (s.shape === 'line' || s.shape === 'arrow') {
          const start = toDoc(s.x, s.y, scale, pgH)
          const end = toDoc(s.x + s.width, s.y + s.height, scale, pgH)
          page.drawLine({
            start, end,
            color: rgb(c.r, c.g, c.b),
            thickness: sw,
            lineCap: LineCapStyle.Round,
            opacity: shapeOpacity,
          })
          if (s.shape === 'arrow') {
            const angle = Math.atan2(end.y - start.y, end.x - start.x)
            const hl = 12 / scale
            const a1 = angle + Math.PI * 0.75
            const a2 = angle - Math.PI * 0.75
            page.drawLine({
              start: { x: end.x + Math.cos(a1) * hl, y: end.y + Math.sin(a1) * hl },
              end,
              color: rgb(c.r, c.g, c.b), thickness: sw, opacity: shapeOpacity,
            })
            page.drawLine({
              start: { x: end.x + Math.cos(a2) * hl, y: end.y + Math.sin(a2) * hl },
              end,
              color: rgb(c.r, c.g, c.b), thickness: sw, opacity: shapeOpacity,
            })
          }
        }
        break
      }

      case 'stickynote': {
        const sn = ann as StickyNoteAnnotation
        if (!sn.text.trim()) break  // Don't embed empty sticky notes
        const c = hexToRgb(sn.color)
        const pos = toDoc(sn.x, sn.y + 14, scale, pgH)
        // Embed as a small text block with a colored background indicator
        const snFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
        const textSize = 8 / scale
        // Draw a small colored square as indicator
        page.drawRectangle({
          x: pos.x - 1 / scale,
          y: pos.y - 1 / scale,
          width: 10 / scale,
          height: 10 / scale,
          color: rgb(c.r, c.g, c.b),
          opacity: sn.opacity ?? 1,
        })
        // Draw the note text next to the indicator
        page.drawText(sn.text, {
          x: pos.x + 12 / scale,
          y: pos.y,
          size: textSize,
          font: snFont,
          color: rgb(c.r, c.g, c.b),
          lineHeight: textSize * 1.3,
          opacity: sn.opacity ?? 1,
        })
        break
      }

      case 'polygon': {
        const poly = ann as PolygonAnnotation
        const c = hexToRgb(poly.color)
        const sw = poly.strokeWidth / scale
        const polyOpacity = poly.opacity ?? 1
        const pts = poly.points
        if (pts.length < 3) break
        // Draw each edge of the polygon
        for (let i = 0; i < pts.length; i++) {
          const from = pts[i]
          const to = pts[(i + 1) % pts.length]
          const start = toDoc(from.x, from.y, scale, pgH)
          const end = toDoc(to.x, to.y, scale, pgH)
          page.drawLine({
            start, end,
            color: rgb(c.r, c.g, c.b),
            thickness: sw,
            lineCap: LineCapStyle.Round,
            opacity: polyOpacity,
          })
        }
        break
      }

      case 'callout': {
        const ca = ann as CalloutAnnotation
        const c = hexToRgb(ca.color)
        const caOpacity = ca.opacity ?? 1
        const sw = 2 / scale
        const r = 8 / scale

        // Convert body corners to doc coords
        const bodyBL = toDoc(ca.x, ca.y + ca.height, scale, pgH)
        const bodyBR = toDoc(ca.x + ca.width, ca.y + ca.height, scale, pgH)
        const bodyTR = toDoc(ca.x + ca.width, ca.y, scale, pgH)
        const bodyTL = toDoc(ca.x, ca.y, scale, pgH)

        // Draw rounded rect body (4 sides, simplified - no actual arc in pdf-lib drawLine)
        // Top edge
        page.drawLine({ start: { x: bodyTL.x + r, y: bodyTL.y }, end: { x: bodyTR.x - r, y: bodyTR.y }, color: rgb(c.r, c.g, c.b), thickness: sw, opacity: caOpacity })
        // Right edge
        page.drawLine({ start: { x: bodyTR.x, y: bodyTR.y - r }, end: { x: bodyBR.x, y: bodyBR.y + r }, color: rgb(c.r, c.g, c.b), thickness: sw, opacity: caOpacity })
        // Bottom edge (split for tail)
        const tAttachLx = toDoc(Math.max(ca.x + 8, Math.min(ca.x + ca.width / 2 - 10, ca.tailX - 10)), ca.y + ca.height, scale, pgH)
        const tAttachRx = toDoc(Math.min(ca.x + ca.width - 8, Math.max(ca.x + ca.width / 2 + 10, ca.tailX + 10)), ca.y + ca.height, scale, pgH)
        const tailPt = toDoc(ca.tailX, ca.tailY, scale, pgH)
        page.drawLine({ start: { x: bodyBL.x + r, y: bodyBL.y }, end: { x: tAttachLx.x, y: tAttachLx.y }, color: rgb(c.r, c.g, c.b), thickness: sw, opacity: caOpacity })
        // Tail triangle
        page.drawLine({ start: { x: tAttachLx.x, y: tAttachLx.y }, end: tailPt, color: rgb(c.r, c.g, c.b), thickness: sw, opacity: caOpacity })
        page.drawLine({ start: tailPt, end: { x: tAttachRx.x, y: tAttachRx.y }, color: rgb(c.r, c.g, c.b), thickness: sw, opacity: caOpacity })
        page.drawLine({ start: { x: tAttachRx.x, y: tAttachRx.y }, end: { x: bodyBR.x - r, y: bodyBR.y }, color: rgb(c.r, c.g, c.b), thickness: sw, opacity: caOpacity })
        // Left edge
        page.drawLine({ start: { x: bodyBL.x, y: bodyBL.y + r }, end: { x: bodyTL.x, y: bodyTL.y - r }, color: rgb(c.r, c.g, c.b), thickness: sw, opacity: caOpacity })

        // Draw text inside
        if (ca.text.trim()) {
          const caFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
          const textSize = ca.fontSize / scale
          // Position text in center of body
          const textPos = toDoc(ca.x + 8, ca.y + ca.fontSize + 4, scale, pgH)
          page.drawText(ca.text, {
            x: textPos.x,
            y: textPos.y,
            size: textSize,
            font: caFont,
            color: rgb(c.r, c.g, c.b),
            lineHeight: textSize * 1.3,
            opacity: caOpacity,
          })
        }
        break
      }
    }
  }

  return pdfDoc.save()
}
