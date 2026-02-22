// ── Pointer point (captures pen pressure) ─────────────────────────────────
export interface Pt {
  x: number
  y: number
  pressure: number  // 0–1 from PointerEvent.pressure
}

// ── Tools ─────────────────────────────────────────────────────────────────
export type Tool =
  | 'select'
  | 'pan'
  | 'pen'           // freehand / stylus
  | 'eraser'        // erase pen strokes
  | 'rect'          // process box, class box
  | 'roundrect'     // terminal / start-end node
  | 'diamond'       // decision node
  | 'ellipse'       // use-case bubble, state
  | 'parallelogram' // I/O node
  | 'arrow'         // association (filled head)
  | 'dashed-arrow'  // dependency / realization
  | 'line'          // undirected link
  | 'text'          // standalone label

// ── Style ─────────────────────────────────────────────────────────────────
export interface Style {
  stroke: string
  fill: string
  lineWidth: number
  fontSize: number
  arrowBoth: boolean  // bidirectional arrow
  curved: boolean     // curved connector
}

// ── Shapes ────────────────────────────────────────────────────────────────
export interface PenShape {
  id: string
  type: 'pen'
  points: Pt[]
  style: Style
}

export interface BoxShape {
  id: string
  type: 'rect' | 'roundrect' | 'diamond' | 'ellipse' | 'parallelogram'
  x: number
  y: number
  w: number
  h: number
  label: string
  style: Style
}

export interface ConnShape {
  id: string
  type: 'arrow' | 'dashed-arrow' | 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  cx?: number   // quadratic bezier control point (undefined = straight)
  cy?: number
  label: string
  style: Style
}

export interface TextShape {
  id: string
  type: 'text'
  x: number
  y: number
  label: string
  style: Style
}

export type Shape = PenShape | BoxShape | ConnShape | TextShape

// ── Canvas background ─────────────────────────────────────────────────────
export type Background = 'dots' | 'grid' | 'lines' | 'none'

// ── Viewport ──────────────────────────────────────────────────────────────
export interface Viewport {
  tx: number    // pan offset X (CSS pixels)
  ty: number    // pan offset Y (CSS pixels)
  scale: number // zoom scale
}

// ── Bounding box ──────────────────────────────────────────────────────────
export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

export const DEFAULT_STYLE: Style = {
  stroke: '#1e293b',
  fill: 'rgba(255,255,255,0)',
  lineWidth: 2,
  fontSize: 13,
  arrowBoth: false,
  curved: false,
}
