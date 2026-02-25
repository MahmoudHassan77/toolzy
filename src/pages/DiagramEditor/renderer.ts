import { Shape, Style, Viewport, BBox, ConnShape, BoxShape, Background, PortSide, PortAttach } from './types'

// ── Multi-select helpers ──────────────────────────────────────────────────

/** Returns the union bounding box of all selected shapes */
export function getSelectionBBox(shapes: Shape[], ids: string[]): BBox | null {
  if (ids.length === 0) return null
  const idSet = new Set(ids)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of shapes) {
    if (!idSet.has(s.id)) continue
    const bb = getBBox(s)
    if (!bb) continue
    minX = Math.min(minX, bb.x)
    minY = Math.min(minY, bb.y)
    maxX = Math.max(maxX, bb.x + bb.w)
    maxY = Math.max(maxY, bb.y + bb.h)
  }
  if (!isFinite(minX)) return null
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** Render a rubber-band selection rectangle (dashed blue) */
export function renderRubberBand(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
) {
  ctx.save()
  ctx.fillStyle = 'rgba(59,130,246,0.08)'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 1.2
  ctx.setLineDash([5, 3])
  ctx.strokeRect(x, y, w, h)
  ctx.restore()
}

// ── Selection handle constants (must match Canvas hit detection) ───────────
export const HANDLE_PAD = 7   // world-unit padding around bbox
export const HANDLE_SIZE = 5  // half-size of each handle square

export function getHandlePositions(bb: BBox): [number, number][] {
  const x = bb.x - HANDLE_PAD, y = bb.y - HANDLE_PAD
  const w = bb.w + HANDLE_PAD * 2, h = bb.h + HANDLE_PAD * 2
  return [
    [x,         y],          // 0 TL
    [x + w / 2, y],          // 1 TC
    [x + w,     y],          // 2 TR
    [x,         y + h / 2],  // 3 ML
    [x + w,     y + h / 2],  // 4 MR
    [x,         y + h],      // 5 BL
    [x + w / 2, y + h],      // 6 BC
    [x + w,     y + h],      // 7 BR
  ]
}

// ── Smart connector port helpers ──────────────────────────────────────────

const BOX_TYPES = new Set(['rect','roundrect','diamond','ellipse','parallelogram','star','triangle','hexagon'])

function isBoxType(s: Shape): s is BoxShape {
  return BOX_TYPES.has(s.type)
}

/** Get the world position of a named port on a box shape */
export function getPortPosition(shape: BoxShape, port: PortSide): { x: number; y: number } {
  // Normalize to positive dimensions for correct port positions
  const x = Math.min(shape.x, shape.x + shape.w)
  const y = Math.min(shape.y, shape.y + shape.h)
  const w = Math.abs(shape.w)
  const h = Math.abs(shape.h)
  switch (port) {
    case 'top':    return { x: x + w / 2, y }
    case 'right':  return { x: x + w,     y: y + h / 2 }
    case 'bottom': return { x: x + w / 2, y: y + h }
    case 'left':   return { x,            y: y + h / 2 }
  }
}

/** Render port indicator circles on a box shape (blue dots at all 4 sides) */
export function renderPorts(ctx: CanvasRenderingContext2D, shape: BoxShape, vp: Viewport) {
  const ports: PortSide[] = ['top', 'right', 'bottom', 'left']
  const radius = 6 / vp.scale
  ctx.save()
  for (const port of ports) {
    const { x, y } = getPortPosition(shape, port)
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(59,130,246,0.7)'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2 / vp.scale
    ctx.setLineDash([])
    ctx.stroke()
  }
  ctx.restore()
}

/** Find the nearest port within `threshold` world-units of (wx, wy). */
export function findNearestPort(
  shapes: Shape[], wx: number, wy: number, excludeId?: string, threshold = 20,
): { shapeId: string; port: PortSide; x: number; y: number } | null {
  let best: { shapeId: string; port: PortSide; x: number; y: number } | null = null
  let bestDist = threshold
  const ports: PortSide[] = ['top', 'right', 'bottom', 'left']
  for (const s of shapes) {
    if (!isBoxType(s)) continue
    if (excludeId && s.id === excludeId) continue
    for (const port of ports) {
      const pos = getPortPosition(s, port)
      const d = Math.hypot(pos.x - wx, pos.y - wy)
      if (d < bestDist) {
        bestDist = d
        best = { shapeId: s.id, port, x: pos.x, y: pos.y }
      }
    }
  }
  return best
}

/** Resolve a PortAttach to its current world position (or null if shape not found) */
export function resolveAttach(shapes: Shape[], attach: PortAttach): { x: number; y: number } | null {
  const shape = shapes.find(s => s.id === attach.shapeId)
  if (!shape || !isBoxType(shape)) return null
  return getPortPosition(shape, attach.port)
}

// ── Helpers ───────────────────────────────────────────────────────────────

function applyStyle(ctx: CanvasRenderingContext2D, s: Style, dashed = false) {
  ctx.strokeStyle = s.stroke
  ctx.fillStyle = s.fill
  ctx.lineWidth = s.lineWidth
  ctx.setLineDash(dashed ? [8, 5] : [])
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string, cx: number, cy: number, style: Style,
) {
  if (!text.trim()) return
  ctx.save()
  ctx.setLineDash([])
  ctx.fillStyle = style.stroke
  ctx.font = `${style.fontSize}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lines = text.split('\n')
  const lh = style.fontSize * 1.35
  const startY = cy - ((lines.length - 1) * lh) / 2
  lines.forEach((line, i) => ctx.fillText(line, cx, startY + i * lh))
  ctx.restore()
}

function arrowHead(
  ctx: CanvasRenderingContext2D,
  fromX: number, fromY: number,   // "from" direction (tangent source)
  tipX: number,  tipY: number,    // tip of arrowhead
  size: number, filled: boolean,
) {
  const angle = Math.atan2(tipY - fromY, tipX - fromX)
  ctx.save()
  ctx.translate(tipX, tipY)
  ctx.rotate(angle)
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-size, -size * 0.45)
  if (!filled) ctx.lineTo(-size * 0.65, 0)
  ctx.lineTo(-size, size * 0.45)
  ctx.closePath()
  ctx.fillStyle = filled ? ctx.strokeStyle as string : 'transparent'
  if (filled) ctx.fill(); else ctx.stroke()
  ctx.restore()
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const rx = Math.sign(w) * Math.min(Math.abs(r), Math.abs(w) / 2)
  const ry = Math.sign(h) * Math.min(Math.abs(r), Math.abs(h) / 2)
  ctx.moveTo(x + rx, y)
  ctx.lineTo(x + w - rx, y)
  ctx.arcTo(x + w, y, x + w, y + ry, Math.abs(rx))
  ctx.lineTo(x + w, y + h - ry)
  ctx.arcTo(x + w, y + h, x + w - rx, y + h, Math.abs(rx))
  ctx.lineTo(x + rx, y + h)
  ctx.arcTo(x, y + h, x, y + h - ry, Math.abs(rx))
  ctx.lineTo(x, y + ry)
  ctx.arcTo(x, y, x + rx, y, Math.abs(rx))
  ctx.closePath()
}

// ── BBox ──────────────────────────────────────────────────────────────────

export function getBBox(shape: Shape): BBox | null {
  switch (shape.type) {
    case 'rect':
    case 'roundrect':
    case 'diamond':
    case 'ellipse':
    case 'parallelogram':
    case 'star':
    case 'triangle':
    case 'hexagon':
      return {
        x: Math.min(shape.x, shape.x + shape.w),
        y: Math.min(shape.y, shape.y + shape.h),
        w: Math.abs(shape.w),
        h: Math.abs(shape.h),
      }
    case 'arrow':
    case 'dashed-arrow':
    case 'line': {
      const pad = Math.max(14, shape.style.lineWidth * 2)
      const xs = [shape.x1, shape.x2]
      const ys = [shape.y1, shape.y2]
      if (shape.cx !== undefined) xs.push(shape.cx)
      if (shape.cy !== undefined) ys.push(shape.cy)
      const minX = Math.min(...xs), minY = Math.min(...ys)
      return {
        x: minX - pad, y: minY - pad,
        w: Math.max(...xs) - minX + pad * 2,
        h: Math.max(...ys) - minY + pad * 2,
      }
    }
    case 'text': {
      const maxChars = Math.max(...shape.label.split('\n').map(l => l.length), 1)
      const lines = shape.label.split('\n').length
      return {
        x: shape.x, y: shape.y,
        w: maxChars * shape.style.fontSize * 0.58,
        h: lines * shape.style.fontSize * 1.35,
      }
    }
    case 'pen': {
      if (shape.points.length === 0) return null
      const xs = shape.points.map(p => p.x)
      const ys = shape.points.map(p => p.y)
      const pad = shape.style.lineWidth * 2
      const x = Math.min(...xs), y = Math.min(...ys)
      return { x: x - pad, y: y - pad, w: Math.max(...xs) - x + pad * 2, h: Math.max(...ys) - y + pad * 2 }
    }
  }
}

export function hitTest(shape: Shape, wx: number, wy: number): boolean {
  const bb = getBBox(shape)
  if (!bb) return false
  const pad = 10
  return wx >= bb.x - pad && wx <= bb.x + bb.w + pad &&
         wy >= bb.y - pad && wy <= bb.y + bb.h + pad
}

// ── Shape renderer ────────────────────────────────────────────────────────

export function renderShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  selected = false,
  dragOffset?: { dx: number; dy: number },
  allShapes?: Shape[],
) {
  ctx.save()
  if (dragOffset) ctx.translate(dragOffset.dx, dragOffset.dy)

  switch (shape.type) {

    case 'pen': {
      const pts = shape.points
      if (pts.length < 2) break
      ctx.strokeStyle = shape.style.stroke
      ctx.lineWidth = shape.style.lineWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.setLineDash([])
      ctx.beginPath()
      // Midpoint smoothing: move to first midpoint, then quadratic bezier
      // through each actual point to the next midpoint — one continuous path.
      const m0x = (pts[0].x + pts[1].x) / 2
      const m0y = (pts[0].y + pts[1].y) / 2
      ctx.moveTo(pts[0].x, pts[0].y)
      ctx.lineTo(m0x, m0y)
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2
        const my = (pts[i].y + pts[i + 1].y) / 2
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
      ctx.stroke()
      break
    }

    case 'rect': {
      applyStyle(ctx, shape.style)
      ctx.beginPath()
      ctx.rect(shape.x, shape.y, shape.w, shape.h)
      ctx.fill(); ctx.stroke()
      drawLabel(ctx, shape.label, shape.x + shape.w / 2, shape.y + shape.h / 2, shape.style)
      break
    }

    case 'roundrect': {
      applyStyle(ctx, shape.style)
      const r = Math.min(Math.abs(shape.w), Math.abs(shape.h)) * 0.22
      ctx.beginPath()
      roundedRectPath(ctx, shape.x, shape.y, shape.w, shape.h, r)
      ctx.fill(); ctx.stroke()
      drawLabel(ctx, shape.label, shape.x + shape.w / 2, shape.y + shape.h / 2, shape.style)
      break
    }

    case 'diamond': {
      applyStyle(ctx, shape.style)
      const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2
      ctx.beginPath()
      ctx.moveTo(cx, shape.y); ctx.lineTo(shape.x + shape.w, cy)
      ctx.lineTo(cx, shape.y + shape.h); ctx.lineTo(shape.x, cy)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
      drawLabel(ctx, shape.label, cx, cy, shape.style)
      break
    }

    case 'ellipse': {
      applyStyle(ctx, shape.style)
      const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.abs(shape.w / 2), Math.abs(shape.h / 2), 0, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
      drawLabel(ctx, shape.label, cx, cy, shape.style)
      break
    }

    case 'parallelogram': {
      applyStyle(ctx, shape.style)
      const slant = Math.abs(shape.h) * 0.2 * Math.sign(shape.w)
      ctx.beginPath()
      ctx.moveTo(shape.x + slant, shape.y); ctx.lineTo(shape.x + shape.w, shape.y)
      ctx.lineTo(shape.x + shape.w - slant, shape.y + shape.h); ctx.lineTo(shape.x, shape.y + shape.h)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
      drawLabel(ctx, shape.label, shape.x + shape.w / 2, shape.y + shape.h / 2, shape.style)
      break
    }

    case 'star': {
      applyStyle(ctx, shape.style)
      const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2
      const outerRx = Math.abs(shape.w) / 2, outerRy = Math.abs(shape.h) / 2
      const innerRx = outerRx * 0.38, innerRy = outerRy * 0.38
      const points = 5
      ctx.beginPath()
      for (let i = 0; i < points * 2; i++) {
        // Start from top (-PI/2), alternate outer/inner vertices
        const angle = -Math.PI / 2 + (i * Math.PI) / points
        const rx = i % 2 === 0 ? outerRx : innerRx
        const ry = i % 2 === 0 ? outerRy : innerRy
        const px = cx + rx * Math.cos(angle)
        const py = cy + ry * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill(); ctx.stroke()
      drawLabel(ctx, shape.label, cx, cy, shape.style)
      break
    }

    case 'triangle': {
      applyStyle(ctx, shape.style)
      const cx = shape.x + shape.w / 2
      // Three vertices: top-center, bottom-left, bottom-right
      ctx.beginPath()
      ctx.moveTo(cx, shape.y)                                  // top
      ctx.lineTo(shape.x + shape.w, shape.y + shape.h)         // bottom-right
      ctx.lineTo(shape.x, shape.y + shape.h)                   // bottom-left
      ctx.closePath()
      ctx.fill(); ctx.stroke()
      // Label centered vertically at 2/3 height (visual center of triangle)
      drawLabel(ctx, shape.label, cx, shape.y + shape.h * 0.6, shape.style)
      break
    }

    case 'hexagon': {
      applyStyle(ctx, shape.style)
      const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2
      const rx = Math.abs(shape.w) / 2, ry = Math.abs(shape.h) / 2
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        // Start from top (-PI/2) → flat-top hexagon
        const angle = -Math.PI / 2 + (i * Math.PI) / 3
        const px = cx + rx * Math.cos(angle)
        const py = cy + ry * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill(); ctx.stroke()
      drawLabel(ctx, shape.label, cx, cy, shape.style)
      break
    }

    case 'arrow':
    case 'dashed-arrow':
    case 'line': {
      // Resolve smart connector attachments to override endpoints
      let sx1 = shape.x1, sy1 = shape.y1, sx2 = shape.x2, sy2 = shape.y2
      if (allShapes) {
        if (shape.startAttach) {
          const pos = resolveAttach(allShapes, shape.startAttach)
          if (pos) { sx1 = pos.x; sy1 = pos.y }
        }
        if (shape.endAttach) {
          const pos = resolveAttach(allShapes, shape.endAttach)
          if (pos) { sx2 = pos.x; sy2 = pos.y }
        }
      }

      applyStyle(ctx, shape.style, shape.type === 'dashed-arrow')
      const hasCurve = shape.cx !== undefined && shape.cy !== undefined
      ctx.beginPath()
      ctx.moveTo(sx1, sy1)
      if (hasCurve) {
        ctx.quadraticCurveTo(shape.cx!, shape.cy!, sx2, sy2)
      } else {
        ctx.lineTo(sx2, sy2)
      }
      ctx.stroke()

      if (shape.type !== 'line') {
        ctx.setLineDash([])
        ctx.strokeStyle = shape.style.stroke
        ctx.lineWidth = shape.style.lineWidth
        // Tangent direction at endpoint
        const fromX = hasCurve ? shape.cx! : sx1
        const fromY = hasCurve ? shape.cy! : sy1
        arrowHead(ctx, fromX, fromY, sx2, sy2, 12, shape.type === 'arrow')
        if (shape.style.arrowBoth) {
          const fromX2 = hasCurve ? shape.cx! : sx2
          const fromY2 = hasCurve ? shape.cy! : sy2
          arrowHead(ctx, fromX2, fromY2, sx1, sy1, 12, shape.type === 'arrow')
        }
      }

      if (shape.label) {
        const lx = hasCurve
          ? (sx1 + 2 * shape.cx! + sx2) / 4   // bezier midpoint approximation
          : (sx1 + sx2) / 2
        const ly = hasCurve
          ? (sy1 + 2 * shape.cy! + sy2) / 4
          : (sy1 + sy2) / 2
        const angle = Math.atan2(sy2 - sy1, sx2 - sx1)
        drawLabel(ctx, shape.label, lx - Math.sin(angle) * 12, ly + Math.cos(angle) * 12, shape.style)
      }

      // Attachment indicator dots (small green circles at attached ports)
      if (shape.startAttach || shape.endAttach) {
        ctx.save()
        ctx.setLineDash([])
        if (shape.startAttach) {
          ctx.beginPath()
          ctx.arc(sx1, sy1, 4, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(34,197,94,0.8)'
          ctx.fill()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
        if (shape.endAttach) {
          ctx.beginPath()
          ctx.arc(sx2, sy2, 4, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(34,197,94,0.8)'
          ctx.fill()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
        ctx.restore()
      }

      // Control-point handle (selected curved connector)
      if (selected && hasCurve) {
        ctx.save()
        // Guide lines from endpoints to control point
        ctx.strokeStyle = '#94a3b8'
        ctx.lineWidth = 1 / (dragOffset ? 1 : 1)
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(sx1, sy1)
        ctx.lineTo(shape.cx!, shape.cy!)
        ctx.lineTo(sx2, sy2)
        ctx.stroke()
        // Handle dot
        ctx.setLineDash([])
        ctx.fillStyle = '#fff'
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(shape.cx!, shape.cy!, 7, 0, Math.PI * 2)
        ctx.fill(); ctx.stroke()
        ctx.restore()
      }
      break
    }

    case 'text': {
      ctx.fillStyle = shape.style.stroke
      ctx.font = `${shape.style.fontSize}px system-ui, sans-serif`
      ctx.textBaseline = 'top'
      ctx.setLineDash([])
      shape.label.split('\n').forEach((line, i) =>
        ctx.fillText(line, shape.x, shape.y + i * shape.style.fontSize * 1.35)
      )
      break
    }
  }

  // ── Selection handles (not shown for pen strokes) ─────────────────────
  if (selected && shape.type !== 'pen') {
    const bb = getBBox(shape)
    if (bb) {
      const pad = HANDLE_PAD
      const x = bb.x - pad, y = bb.y - pad, w = bb.w + pad * 2, h = bb.h + pad * 2
      ctx.save()
      ctx.fillStyle = 'rgba(59,130,246,0.07)'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 3])
      ctx.strokeRect(x, y, w, h)

      // Draw resize handles only on box shapes
      const isBox = ['rect', 'roundrect', 'diamond', 'ellipse', 'parallelogram', 'star', 'triangle', 'hexagon'].includes(shape.type)
      if (isBox) {
        ctx.setLineDash([])
        for (const [hx, hy] of getHandlePositions(bb)) {
          ctx.fillStyle = '#fff'
          ctx.fillRect(hx - HANDLE_SIZE, hy - HANDLE_SIZE, HANDLE_SIZE * 2, HANDLE_SIZE * 2)
          ctx.strokeStyle = '#3b82f6'
          ctx.lineWidth = 1.5
          ctx.strokeRect(hx - HANDLE_SIZE, hy - HANDLE_SIZE, HANDLE_SIZE * 2, HANDLE_SIZE * 2)
        }
      }
      ctx.restore()
    }
  }

  ctx.restore()
}

// ── Background / grid ──────────────────────────────────────────────────────

export function renderGrid(
  ctx: CanvasRenderingContext2D,
  vp: Viewport, W: number, H: number,
  bg: Background = 'dots',
) {
  if (bg === 'none') return

  const spacing = 24
  const left   = -vp.tx / vp.scale
  const top    = -vp.ty / vp.scale
  const right  = (W - vp.tx) / vp.scale
  const bottom = (H - vp.ty) / vp.scale
  if ((right - left) / spacing > 300) return

  const startX = Math.floor(left / spacing) * spacing
  const startY = Math.floor(top  / spacing) * spacing

  ctx.save()

  if (bg === 'dots') {
    const dotR = 0.9 / vp.scale
    ctx.fillStyle = 'rgba(100,116,139,0.30)'
    for (let wx = startX; wx <= right; wx += spacing) {
      for (let wy = startY; wy <= bottom; wy += spacing) {
        ctx.beginPath()
        ctx.arc(wx, wy, dotR, 0, Math.PI * 2)
        ctx.fill()
      }
    }

  } else if (bg === 'grid') {
    ctx.strokeStyle = 'rgba(100,116,139,0.18)'
    ctx.lineWidth = 1 / vp.scale
    ctx.setLineDash([])
    // Vertical lines
    for (let wx = startX; wx <= right; wx += spacing) {
      ctx.beginPath(); ctx.moveTo(wx, top); ctx.lineTo(wx, bottom); ctx.stroke()
    }
    // Horizontal lines
    for (let wy = startY; wy <= bottom; wy += spacing) {
      ctx.beginPath(); ctx.moveTo(left, wy); ctx.lineTo(right, wy); ctx.stroke()
    }

  } else if (bg === 'lines') {
    ctx.strokeStyle = 'rgba(100,116,139,0.18)'
    ctx.lineWidth = 1 / vp.scale
    ctx.setLineDash([])
    for (let wy = startY; wy <= bottom; wy += spacing) {
      ctx.beginPath(); ctx.moveTo(left, wy); ctx.lineTo(right, wy); ctx.stroke()
    }
  }

  ctx.restore()
}

// ── Preview shape builder ─────────────────────────────────────────────────

export function buildPreview(
  tool: string,
  x0: number, y0: number,
  x1: number, y1: number,
  style: Style,
): Shape | null {
  const id = '_preview'
  // For curved connectors, auto-compute a control point
  const cx = style.curved
    ? (x0 + x1) / 2 + (y1 - y0) * 0.3
    : undefined
  const cy = style.curved
    ? (y0 + y1) / 2 - (x1 - x0) * 0.3
    : undefined

  switch (tool) {
    case 'rect':         return { id, type: 'rect',         x: x0, y: y0, w: x1-x0, h: y1-y0, label: '', style }
    case 'roundrect':    return { id, type: 'roundrect',    x: x0, y: y0, w: x1-x0, h: y1-y0, label: '', style }
    case 'diamond':      return { id, type: 'diamond',      x: x0, y: y0, w: x1-x0, h: y1-y0, label: '', style }
    case 'ellipse':      return { id, type: 'ellipse',      x: x0, y: y0, w: x1-x0, h: y1-y0, label: '', style }
    case 'parallelogram':return { id, type: 'parallelogram',x: x0, y: y0, w: x1-x0, h: y1-y0, label: '', style }
    case 'star':         return { id, type: 'star',         x: x0, y: y0, w: x1-x0, h: y1-y0, label: '', style }
    case 'triangle':     return { id, type: 'triangle',     x: x0, y: y0, w: x1-x0, h: y1-y0, label: '', style }
    case 'hexagon':      return { id, type: 'hexagon',      x: x0, y: y0, w: x1-x0, h: y1-y0, label: '', style }
    case 'arrow':        return { id, type: 'arrow',        x1: x0, y1: y0, x2: x1, y2: y1, cx, cy, label: '', style }
    case 'dashed-arrow': return { id, type: 'dashed-arrow', x1: x0, y1: y0, x2: x1, y2: y1, cx, cy, label: '', style }
    case 'line':         return { id, type: 'line',         x1: x0, y1: y0, x2: x1, y2: y1, cx, cy, label: '', style }
    default: return null
  }
}

// ── Resize math (exported for Canvas) ────────────────────────────────────

export function applyResize(
  handleIdx: number,
  ox: number, oy: number, ow: number, oh: number,
  dx: number, dy: number,
): { x: number; y: number; w: number; h: number } {
  const MIN = 20
  let x = ox, y = oy, w = ow, h = oh
  switch (handleIdx) {
    case 0: x = ox+dx; y = oy+dy; w = ow-dx; h = oh-dy; break  // TL
    case 1:            y = oy+dy;             h = oh-dy; break  // TC
    case 2:            y = oy+dy; w = ow+dx;  h = oh-dy; break  // TR
    case 3: x = ox+dx;           w = ow-dx;             break  // ML
    case 4:                      w = ow+dx;             break  // MR
    case 5: x = ox+dx;           w = ow-dx;  h = oh+dy; break  // BL
    case 6:                                   h = oh+dy; break  // BC
    case 7:                      w = ow+dx;  h = oh+dy; break  // BR
  }
  if (w < MIN) { if ([0,3,5].includes(handleIdx)) x = ox+ow-MIN; w = MIN }
  if (h < MIN) { if ([0,1,2].includes(handleIdx)) y = oy+oh-MIN; h = MIN }
  return { x, y, w, h }
}

// ── Move offset helper (exported for Canvas) ──────────────────────────────

export function applyMoveOffset(shape: Shape, dx: number, dy: number): Shape {
  switch (shape.type) {
    case 'pen':
      return { ...shape, points: shape.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) }
    case 'arrow': case 'dashed-arrow': case 'line':
      return {
        ...shape, x1: shape.x1+dx, y1: shape.y1+dy, x2: shape.x2+dx, y2: shape.y2+dy,
        cx: shape.cx !== undefined ? shape.cx+dx : undefined,
        cy: shape.cy !== undefined ? shape.cy+dy : undefined,
      }
    case 'text':
      return { ...shape, x: shape.x+dx, y: shape.y+dy }
    default:
      return { ...shape, x: (shape as BoxShape).x+dx, y: (shape as BoxShape).y+dy } as Shape
  }
}
