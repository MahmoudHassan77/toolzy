import { Shape, BoxShape, ConnShape, TextShape, PenShape, Style } from './types'
import { getBBox } from './renderer'

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function styleAttrs(s: Style, dashed = false): string {
  const parts: string[] = [
    `stroke="${s.stroke}"`,
    `stroke-width="${s.lineWidth}"`,
    `stroke-linecap="round"`,
    `stroke-linejoin="round"`,
  ]
  if (dashed) parts.push(`stroke-dasharray="8 5"`)
  return parts.join(' ')
}

function fillAttr(fill: string): string {
  if (fill === 'transparent' || fill === 'rgba(255,255,255,0)') return 'fill="none"'
  return `fill="${fill}"`
}

/** Generate an SVG <text> element (supports multiline via <tspan>) */
function svgLabel(
  text: string,
  cx: number, cy: number,
  style: Style,
  textBaseline: 'middle' | 'top' = 'middle',
): string {
  if (!text.trim()) return ''
  const lines = text.split('\n')
  const lh = style.fontSize * 1.35
  const anchor = textBaseline === 'middle' ? 'middle' : 'start'
  const dy0 = textBaseline === 'middle'
    ? cy - ((lines.length - 1) * lh) / 2
    : cy + style.fontSize * 0.85 // approximate top baseline offset

  if (lines.length === 1) {
    const x = textBaseline === 'middle' ? cx : cx
    return `  <text x="${x}" y="${dy0}" fill="${style.stroke}" font-size="${style.fontSize}" font-family="system-ui, sans-serif" text-anchor="${anchor}" dominant-baseline="middle">${escapeXml(lines[0])}</text>`
  }

  const tspans = lines.map((line, i) => {
    const y = dy0 + i * lh
    const x = textBaseline === 'middle' ? cx : cx
    return `    <tspan x="${x}" y="${y}">${escapeXml(line)}</tspan>`
  }).join('\n')

  return `  <text fill="${style.stroke}" font-size="${style.fontSize}" font-family="system-ui, sans-serif" text-anchor="${anchor}" dominant-baseline="middle">\n${tspans}\n  </text>`
}

// ── Arrowhead marker definition ─────────────────────────────────────────────

let markerCounter = 0

function arrowMarkerDef(color: string, filled: boolean): { id: string; def: string } {
  const id = `arrowhead_${++markerCounter}`
  // Arrow geometry matches renderer: size=12, spread=0.45
  const size = 12
  const spread = size * 0.45
  if (filled) {
    return {
      id,
      def: `  <marker id="${id}" viewBox="0 0 ${size} ${spread * 2}" refX="${size}" refY="${spread}" markerWidth="${size}" markerHeight="${spread * 2}" orient="auto-start-reverse">
    <path d="M0,0 L${size},${spread} L0,${spread * 2} Z" fill="${color}" />
  </marker>`,
    }
  } else {
    return {
      id,
      def: `  <marker id="${id}" viewBox="0 0 ${size} ${spread * 2}" refX="${size}" refY="${spread}" markerWidth="${size}" markerHeight="${spread * 2}" orient="auto-start-reverse">
    <path d="M0,0 L${size},${spread} L${size * 0.65},${spread} L0,${spread * 2} Z" fill="none" stroke="${color}" stroke-width="1" />
  </marker>`,
    }
  }
}

// ── Shape → SVG element conversion ──────────────────────────────────────────

function penToSVG(shape: PenShape): string {
  const pts = shape.points
  if (pts.length < 2) return ''

  // Build the same smoothed path as the canvas renderer
  const parts: string[] = []
  parts.push(`M${pts[0].x},${pts[0].y}`)
  const m0x = (pts[0].x + pts[1].x) / 2
  const m0y = (pts[0].y + pts[1].y) / 2
  parts.push(`L${m0x},${m0y}`)
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2
    const my = (pts[i].y + pts[i + 1].y) / 2
    parts.push(`Q${pts[i].x},${pts[i].y} ${mx},${my}`)
  }
  parts.push(`L${pts[pts.length - 1].x},${pts[pts.length - 1].y}`)

  return `  <path d="${parts.join(' ')}" fill="none" ${styleAttrs(shape.style)} />`
}

function boxToSVG(shape: BoxShape): string {
  const lines: string[] = []
  const s = shape.style
  const { x, y, w, h } = shape

  switch (shape.type) {
    case 'rect': {
      lines.push(`  <rect x="${x}" y="${y}" width="${w}" height="${h}" ${fillAttr(s.fill)} ${styleAttrs(s)} />`)
      break
    }
    case 'roundrect': {
      const r = Math.min(Math.abs(w), Math.abs(h)) * 0.22
      lines.push(`  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${fillAttr(s.fill)} ${styleAttrs(s)} />`)
      break
    }
    case 'diamond': {
      const cx = x + w / 2, cy = y + h / 2
      const pts = `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`
      lines.push(`  <polygon points="${pts}" ${fillAttr(s.fill)} ${styleAttrs(s)} />`)
      break
    }
    case 'ellipse': {
      const cx = x + w / 2, cy = y + h / 2
      lines.push(`  <ellipse cx="${cx}" cy="${cy}" rx="${Math.abs(w / 2)}" ry="${Math.abs(h / 2)}" ${fillAttr(s.fill)} ${styleAttrs(s)} />`)
      break
    }
    case 'parallelogram': {
      const slant = Math.abs(h) * 0.2 * Math.sign(w)
      const pts = `${x + slant},${y} ${x + w},${y} ${x + w - slant},${y + h} ${x},${y + h}`
      lines.push(`  <polygon points="${pts}" ${fillAttr(s.fill)} ${styleAttrs(s)} />`)
      break
    }
    case 'star': {
      const cx = x + w / 2, cy = y + h / 2
      const outerRx = Math.abs(w) / 2, outerRy = Math.abs(h) / 2
      const innerRx = outerRx * 0.38, innerRy = outerRy * 0.38
      const numPoints = 5
      const starPts: string[] = []
      for (let i = 0; i < numPoints * 2; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / numPoints
        const rx = i % 2 === 0 ? outerRx : innerRx
        const ry = i % 2 === 0 ? outerRy : innerRy
        starPts.push(`${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`)
      }
      lines.push(`  <polygon points="${starPts.join(' ')}" ${fillAttr(s.fill)} ${styleAttrs(s)} />`)
      break
    }
    case 'triangle': {
      const cx = x + w / 2
      const pts = `${cx},${y} ${x + w},${y + h} ${x},${y + h}`
      lines.push(`  <polygon points="${pts}" ${fillAttr(s.fill)} ${styleAttrs(s)} />`)
      break
    }
    case 'hexagon': {
      const cx = x + w / 2, cy = y + h / 2
      const rx = Math.abs(w) / 2, ry = Math.abs(h) / 2
      const hexPts: string[] = []
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 3
        hexPts.push(`${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`)
      }
      lines.push(`  <polygon points="${hexPts.join(' ')}" ${fillAttr(s.fill)} ${styleAttrs(s)} />`)
      break
    }
  }

  // Label centered in the shape
  const labelCy = shape.type === 'triangle' ? y + h * 0.6 : y + h / 2
  const label = svgLabel(shape.label, x + w / 2, labelCy, s)
  if (label) lines.push(label)

  return lines.join('\n')
}

function connToSVG(shape: ConnShape, defs: string[]): string {
  const lines: string[] = []
  const s = shape.style
  const hasCurve = shape.cx !== undefined && shape.cy !== undefined
  const dashed = shape.type === 'dashed-arrow'
  const isLine = shape.type === 'line'
  const filled = shape.type === 'arrow'

  // Create arrowhead markers if needed
  let endMarkerId = ''
  let startMarkerId = ''
  if (!isLine) {
    const endMarker = arrowMarkerDef(s.stroke, filled)
    endMarkerId = endMarker.id
    defs.push(endMarker.def)
    if (s.arrowBoth) {
      const startMarker = arrowMarkerDef(s.stroke, filled)
      startMarkerId = startMarker.id
      defs.push(startMarker.def)
    }
  }

  const markerEnd = endMarkerId ? ` marker-end="url(#${endMarkerId})"` : ''
  const markerStart = startMarkerId ? ` marker-start="url(#${startMarkerId})"` : ''

  if (hasCurve) {
    const d = `M${shape.x1},${shape.y1} Q${shape.cx},${shape.cy} ${shape.x2},${shape.y2}`
    lines.push(`  <path d="${d}" fill="none" ${styleAttrs(s, dashed)}${markerEnd}${markerStart} />`)
  } else {
    lines.push(`  <line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" ${styleAttrs(s, dashed)}${markerEnd}${markerStart} />`)
  }

  // Connector label
  if (shape.label) {
    const lx = hasCurve
      ? (shape.x1 + 2 * shape.cx! + shape.x2) / 4
      : (shape.x1 + shape.x2) / 2
    const ly = hasCurve
      ? (shape.y1 + 2 * shape.cy! + shape.y2) / 4
      : (shape.y1 + shape.y2) / 2
    const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1)
    const label = svgLabel(
      shape.label,
      lx - Math.sin(angle) * 12,
      ly + Math.cos(angle) * 12,
      s,
    )
    if (label) lines.push(label)
  }

  return lines.join('\n')
}

function textToSVG(shape: TextShape): string {
  const s = shape.style
  const lines = shape.label.split('\n')
  const lh = s.fontSize * 1.35

  if (lines.length === 1) {
    return `  <text x="${shape.x}" y="${shape.y + s.fontSize * 0.85}" fill="${s.stroke}" font-size="${s.fontSize}" font-family="system-ui, sans-serif" text-anchor="start">${escapeXml(lines[0])}</text>`
  }

  const tspans = lines.map((line, i) => {
    const y = shape.y + s.fontSize * 0.85 + i * lh
    return `    <tspan x="${shape.x}" y="${y}">${escapeXml(line)}</tspan>`
  }).join('\n')

  return `  <text fill="${s.stroke}" font-size="${s.fontSize}" font-family="system-ui, sans-serif" text-anchor="start">\n${tspans}\n  </text>`
}

// ── Main export function ────────────────────────────────────────────────────

export function exportSVG(shapes: Shape[], background: string): string {
  if (shapes.length === 0) {
    // Empty diagram - return a minimal SVG
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect width="800" height="600" fill="white" />
</svg>`
  }

  // Reset marker counter for each export
  markerCounter = 0

  // Calculate bounding box of all shapes
  const PADDING = 40
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (const shape of shapes) {
    const bb = getBBox(shape)
    if (!bb) continue
    minX = Math.min(minX, bb.x)
    minY = Math.min(minY, bb.y)
    maxX = Math.max(maxX, bb.x + bb.w)
    maxY = Math.max(maxY, bb.y + bb.h)
  }

  if (!isFinite(minX)) {
    minX = 0; minY = 0; maxX = 800; maxY = 600
  }

  const vbX = minX - PADDING
  const vbY = minY - PADDING
  const vbW = (maxX - minX) + PADDING * 2
  const vbH = (maxY - minY) + PADDING * 2

  const defs: string[] = []
  const elements: string[] = []

  // Background rect
  if (background !== 'none') {
    elements.push(`  <rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="white" />`)
  }

  // Convert each shape
  for (const shape of shapes) {
    switch (shape.type) {
      case 'pen':
        elements.push(penToSVG(shape))
        break
      case 'rect':
      case 'roundrect':
      case 'diamond':
      case 'ellipse':
      case 'parallelogram':
      case 'star':
      case 'triangle':
      case 'hexagon':
        elements.push(boxToSVG(shape))
        break
      case 'arrow':
      case 'dashed-arrow':
      case 'line':
        elements.push(connToSVG(shape, defs))
        break
      case 'text':
        elements.push(textToSVG(shape))
        break
    }
  }

  // Assemble SVG
  const defsBlock = defs.length > 0
    ? `\n<defs>\n${defs.join('\n')}\n</defs>\n`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${vbW}" height="${vbH}">${defsBlock}
${elements.filter(Boolean).join('\n')}
</svg>`
}
