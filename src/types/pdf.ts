export type ToolType =
  | 'select'
  | 'eraser'
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'whiteout'
  | 'text'
  | 'stamp'
  | 'stickynote'
  | 'draw'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'polygon'
  | 'callout'
  | 'signature'

export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow' | 'polygon'
export type StampSymbol = '✓' | '✗' | '●' | string // date string also valid

export interface HighlightAnnotation {
  id: string
  type: 'highlight'
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  color: string
  markupStyle?: 'highlight' | 'underline' | 'strikethrough'
  opacity?: number
}

export interface TextAnnotation {
  id: string
  type: 'text'
  pageIndex: number
  x: number
  y: number
  text: string
  fontSize: number
  color: string
}

export interface SignatureAnnotation {
  id: string
  type: 'signature'
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  dataUrl: string
}

export interface DrawAnnotation {
  id: string
  type: 'draw'
  pageIndex: number
  // Absolute SVG path string (coordinates relative to page top-left)
  svgPath: string
  color: string
  strokeWidth: number
  // Bounding box for hit-testing / selection
  x: number
  y: number
  width: number
  height: number
  opacity?: number
}

export interface ShapeAnnotation {
  id: string
  type: 'shape'
  pageIndex: number
  shape: ShapeKind
  x: number
  y: number
  width: number
  height: number
  color: string
  strokeWidth: number
  opacity?: number
}

export interface WhiteoutAnnotation {
  id: string
  type: 'whiteout'
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
}

export interface StampAnnotation {
  id: string
  type: 'stamp'
  pageIndex: number
  x: number
  y: number
  text: string
  color: string
  fontSize: number
}

export interface StickyNoteAnnotation {
  id: string
  type: 'stickynote'
  pageIndex: number
  x: number
  y: number
  text: string
  color: string
  expanded: boolean
  opacity?: number
}

export interface PolygonAnnotation {
  id: string
  type: 'polygon'
  pageIndex: number
  points: { x: number; y: number }[]
  color: string
  strokeWidth: number
  opacity?: number
  x: number
  y: number
  width: number
  height: number
}

export interface CalloutAnnotation {
  id: string
  type: 'callout'
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  tailX: number
  tailY: number
  text: string
  color: string
  fontSize: number
  opacity?: number
}

export type Annotation =
  | HighlightAnnotation
  | TextAnnotation
  | SignatureAnnotation
  | DrawAnnotation
  | ShapeAnnotation
  | WhiteoutAnnotation
  | StampAnnotation
  | StickyNoteAnnotation
  | PolygonAnnotation
  | CalloutAnnotation

export interface PageDimensions {
  width: number
  height: number
  scale: number
}

export interface ToolOptions {
  color: string
  strokeWidth: number
  fontSize: number
  stampSymbol: string
  opacity: number
}

// ── Page operations (applied on save) ────────────────────────────────────────

export type PageOp =
  | { type: 'rotate'; pageIndex: number; degrees: number }
  | { type: 'delete'; pageIndex: number }
  | { type: 'move'; from: number; to: number }
