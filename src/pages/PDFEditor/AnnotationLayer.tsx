import React, { useRef, useState, useCallback, useEffect } from 'react'
import {
  Annotation, ToolType,
  TextAnnotation, SignatureAnnotation, DrawAnnotation, ShapeAnnotation,
  StampAnnotation, WhiteoutAnnotation, HighlightAnnotation, StickyNoteAnnotation,
  PolygonAnnotation, CalloutAnnotation,
} from '../../types/pdf'
import { ToolOptions } from '../../types/pdf'

// ── helpers ─────────────────────────────────────────────────────────────────

function buildSvgPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`
  return d
}

function ptsBbox(pts: { x: number; y: number }[]) {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

interface Rect { x: number; y: number; w: number; h: number }

function buildRect(start: { x: number; y: number }, cur: { x: number; y: number }): Rect {
  return {
    x: Math.min(start.x, cur.x),
    y: Math.min(start.y, cur.y),
    w: Math.abs(cur.x - start.x),
    h: Math.abs(cur.y - start.y),
  }
}

// ── pending text state ───────────────────────────────────────────────────────

interface PendingText { x: number; y: number; value: string }

// ── drag state ───────────────────────────────────────────────────────────────

interface DragState {
  id: string; startX: number; startY: number; origX: number; origY: number
}

// ── resize state ─────────────────────────────────────────────────────────────

interface ResizeState {
  id: string
  handle: number // 0=NW, 1=N, 2=NE, 3=W, 4=E, 5=SW, 6=S, 7=SE
  startX: number
  startY: number
  origX: number
  origY: number
  origW: number
  origH: number
}

// Annotation types that support resize (have width/height)
const RESIZABLE_TYPES = new Set(['highlight', 'whiteout', 'draw', 'shape', 'signature', 'polygon', 'callout'])

// ── SVG shape renderer (for live preview + committed shapes) ─────────────────

function renderShapeSVG(
  shape: 'rect' | 'ellipse' | 'line' | 'arrow',
  x: number, y: number, w: number, h: number,
  color: string, strokeWidth: number,
  preview = false
) {
  const opacity = preview ? 0.6 : 1
  const common = { stroke: color, strokeWidth, fill: 'none', opacity }
  if (shape === 'rect') {
    return <rect x={x} y={y} width={w} height={h} {...common} />
  }
  if (shape === 'ellipse') {
    const rx = w / 2, ry = h / 2
    return <ellipse cx={x + rx} cy={y + ry} rx={Math.abs(rx)} ry={Math.abs(ry)} {...common} />
  }
  if (shape === 'line') {
    return <line x1={x} y1={y} x2={x + w} y2={y + h} {...common} />
  }
  if (shape === 'arrow') {
    const ex = x + w, ey = y + h
    const angle = Math.atan2(ey - y, ex - x)
    const len = 12
    const a1 = angle + Math.PI * 0.75
    const a2 = angle - Math.PI * 0.75
    const head = `M ${ex + Math.cos(a1) * len} ${ey + Math.sin(a1) * len} L ${ex} ${ey} L ${ex + Math.cos(a2) * len} ${ey + Math.sin(a2) * len}`
    return (
      <>
        <line x1={x} y1={y} x2={ex} y2={ey} {...common} />
        <path d={head} {...common} fill="none" />
      </>
    )
  }
  return null
}

// ── component ────────────────────────────────────────────────────────────────

interface AnnotationLayerProps {
  pageIndex: number
  width: number
  height: number
  scale: number
  annotations: Annotation[]
  activeTool: ToolType
  toolOptions: ToolOptions
  onAddHighlight: (pi: number, x: number, y: number, w: number, h: number) => void
  onAddText: (pi: number, x: number, y: number, text: string) => void
  onAddSignature: (pi: number, x: number, y: number) => void
  onAddDraw: (pi: number, svgPath: string, bbox: { x: number; y: number; width: number; height: number }) => void
  onAddShape: (pi: number, shape: 'rect' | 'ellipse' | 'line' | 'arrow', x: number, y: number, w: number, h: number) => void
  onAddWhiteout: (pi: number, x: number, y: number, w: number, h: number) => void
  onAddStamp: (pi: number, x: number, y: number) => void
  onAddStickyNote: (pi: number, x: number, y: number) => void
  onAddUnderline: (pi: number, x: number, y: number, w: number, h: number) => void
  onAddStrikethrough: (pi: number, x: number, y: number, w: number, h: number) => void
  onAddPolygon: (pi: number, points: { x: number; y: number }[]) => void
  onAddCallout: (pi: number, x: number, y: number, w: number, h: number, tailX: number, tailY: number) => void
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void
  onRemoveAnnotation: (id: string) => void
  /** Called once when the user starts dragging an annotation — used to snapshot history */
  onDragStart: () => void
}

// Tools that use drag-to-draw (rect preview)
const RECT_TOOLS = new Set<ToolType>(['highlight', 'underline', 'strikethrough', 'whiteout', 'rect', 'ellipse', 'line', 'arrow', 'callout'])
// Tools that use single click
const CLICK_TOOLS = new Set<ToolType>(['text', 'stamp', 'signature', 'stickynote'])

export default function AnnotationLayer({
  pageIndex, width, height, scale,
  annotations, activeTool, toolOptions,
  onAddHighlight, onAddText, onAddSignature,
  onAddDraw, onAddShape, onAddWhiteout, onAddStamp,
  onAddStickyNote, onAddUnderline, onAddStrikethrough,
  onAddPolygon, onAddCallout,
  onUpdateAnnotation, onRemoveAnnotation, onDragStart,
}: AnnotationLayerProps) {
  // ── drawing state ─────────────────────────────────────────────────────────
  const [rectPreview, setRectPreview] = useState<Rect | null>(null)
  const [drawPts, setDrawPts] = useState<{ x: number; y: number }[]>([])
  const isDrawingRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })

  // ── polygon building state ──────────────────────────────────────────────
  const [polygonPts, setPolygonPts] = useState<{ x: number; y: number }[]>([])
  const [polygonCursor, setPolygonCursor] = useState<{ x: number; y: number } | null>(null)

  // ── callout pending text state ──────────────────────────────────────────
  const [pendingCalloutId, setPendingCalloutId] = useState<string | null>(null)

  // ── text entry state ──────────────────────────────────────────────────────
  const [pendingText, setPendingText] = useState<PendingText | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── drag state ────────────────────────────────────────────────────────────
  const [dragState, setDragState] = useState<DragState | null>(null)

  // ── selection + resize state ──────────────────────────────────────────────
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)

  const pageAnnotations = annotations.filter((a) => a.pageIndex === pageIndex)

  // Auto-focus textarea when pending text appears
  useEffect(() => {
    if (pendingText) textareaRef.current?.focus()
  }, [pendingText])

  // When a new callout is added, auto-open its text editor
  const prevCalloutCountRef = useRef(0)
  useEffect(() => {
    const callouts = pageAnnotations.filter((a) => a.type === 'callout')
    if (callouts.length > prevCalloutCountRef.current) {
      // A new callout was just added — activate its text input
      const newest = callouts[callouts.length - 1] as CalloutAnnotation
      setPendingCalloutId(newest.id)
    }
    prevCalloutCountRef.current = callouts.length
  }, [pageAnnotations])

  // Clear polygon state when tool changes away from polygon
  useEffect(() => {
    if (activeTool !== 'polygon') {
      setPolygonPts([])
      setPolygonCursor(null)
    }
  }, [activeTool])

  // ── position helpers ──────────────────────────────────────────────────────
  const relPos = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  // ── commit pending text ───────────────────────────────────────────────────
  const commitText = useCallback(() => {
    if (!pendingText) return
    const v = pendingText.value.trim()
    if (v) onAddText(pageIndex, pendingText.x, pendingText.y, v)
    setPendingText(null)
  }, [pendingText, onAddText, pageIndex])

  // ── mouse handlers ────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (activeTool === 'select') {
        // Click on empty area → deselect
        setSelectedAnnotationId(null)
        return
      }
      if (activeTool === 'eraser') return   // eraser handled per-annotation
      e.preventDefault()
      // Clear selection when switching to other tools
      setSelectedAnnotationId(null)

      // Commit any pending text first
      if (pendingText) { commitText(); return }

      const pos = relPos(e)

      // Polygon tool: multi-click to build, double-click to close
      if (activeTool === 'polygon') {
        if (e.detail >= 2) {
          // Double-click → close polygon
          if (polygonPts.length >= 3) {
            onAddPolygon(pageIndex, polygonPts)
          }
          setPolygonPts([])
          setPolygonCursor(null)
        } else {
          // Single click → add vertex
          setPolygonPts((prev) => [...prev, pos])
        }
        return
      }

      if (RECT_TOOLS.has(activeTool)) {
        isDrawingRef.current = true
        startPosRef.current = pos
        setRectPreview({ x: pos.x, y: pos.y, w: 0, h: 0 })
        return
      }
      if (activeTool === 'draw') {
        isDrawingRef.current = true
        setDrawPts([pos])
        return
      }
      if (activeTool === 'text') {
        setPendingText({ x: pos.x, y: pos.y, value: '' })
        return
      }
      if (activeTool === 'stamp') {
        onAddStamp(pageIndex, pos.x, pos.y)
        return
      }
      if (activeTool === 'signature') {
        onAddSignature(pageIndex, pos.x, pos.y)
        return
      }
      if (activeTool === 'stickynote') {
        onAddStickyNote(pageIndex, pos.x, pos.y)
        return
      }
    },
    [activeTool, pendingText, commitText, pageIndex, onAddStamp, onAddSignature, onAddStickyNote, polygonPts, onAddPolygon]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const pos = relPos(e)

      // Track cursor for polygon preview
      if (activeTool === 'polygon' && polygonPts.length > 0) {
        setPolygonCursor(pos)
      }

      // Resize annotation
      if (resizeState) {
        const dx = e.clientX - resizeState.startX
        const dy = e.clientY - resizeState.startY
        let { origX: nx, origY: ny, origW: nw, origH: nh } = resizeState
        const h = resizeState.handle
        // NW=0, N=1, NE=2, W=3, E=4, SW=5, S=6, SE=7
        if (h === 0) { nx += dx; ny += dy; nw -= dx; nh -= dy }
        else if (h === 1) { ny += dy; nh -= dy }
        else if (h === 2) { ny += dy; nw += dx; nh -= dy }
        else if (h === 3) { nx += dx; nw -= dx }
        else if (h === 4) { nw += dx }
        else if (h === 5) { nx += dx; nw -= dx; nh += dy }
        else if (h === 6) { nh += dy }
        else if (h === 7) { nw += dx; nh += dy }
        // Enforce minimum size
        if (nw < 10) { nw = 10 }
        if (nh < 10) { nh = 10 }
        onUpdateAnnotation(resizeState.id, { x: nx, y: ny, width: nw, height: nh } as Partial<Annotation>)
        return
      }

      // Drag annotation
      if (dragState) {
        const dx = e.clientX - dragState.startX
        const dy = e.clientY - dragState.startY
        onUpdateAnnotation(dragState.id, { x: dragState.origX + dx, y: dragState.origY + dy } as Partial<Annotation>)
        return
      }
      if (!isDrawingRef.current) return

      if (RECT_TOOLS.has(activeTool)) {
        setRectPreview(buildRect(startPosRef.current, pos))
        return
      }
      if (activeTool === 'draw') {
        setDrawPts((prev) => [...prev, pos])
        return
      }
    },
    [activeTool, dragState, resizeState, onUpdateAnnotation, polygonPts]
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (resizeState) { setResizeState(null); return }
      setDragState(null)
      if (!isDrawingRef.current) return
      isDrawingRef.current = false
      const pos = relPos(e)

      if (RECT_TOOLS.has(activeTool) && rectPreview) {
        const { x, y, w, h } = rectPreview
        if (w > 4 && h > 4) {
          if (activeTool === 'highlight') onAddHighlight(pageIndex, x, y, w, h)
          else if (activeTool === 'underline') onAddUnderline(pageIndex, x, y, w, h)
          else if (activeTool === 'strikethrough') onAddStrikethrough(pageIndex, x, y, w, h)
          else if (activeTool === 'whiteout') onAddWhiteout(pageIndex, x, y, w, h)
          else if (activeTool === 'rect') onAddShape(pageIndex, 'rect', x, y, w, h)
          else if (activeTool === 'ellipse') onAddShape(pageIndex, 'ellipse', x, y, w, h)
          else if (activeTool === 'line') onAddShape(pageIndex, 'line', x, y, w, h)
          else if (activeTool === 'arrow') onAddShape(pageIndex, 'arrow', x, y, w, h)
          else if (activeTool === 'callout') {
            // Auto-place tail at bottom-center offset 30px down
            const tailX = x + w / 2
            const tailY = y + h + 30
            onAddCallout(pageIndex, x, y, w, h, tailX, tailY)
          }
        }
        setRectPreview(null)
        return
      }
      if (activeTool === 'draw' && drawPts.length > 1) {
        const allPts = [...drawPts, pos]
        const svgPath = buildSvgPath(allPts)
        const bbox = ptsBbox(allPts)
        onAddDraw(pageIndex, svgPath, bbox)
        setDrawPts([])
        return
      }
      setDrawPts([])
      setRectPreview(null)
    },
    [activeTool, rectPreview, drawPts, pageIndex,
      onAddHighlight, onAddWhiteout, onAddShape, onAddDraw, onAddUnderline, onAddStrikethrough, onAddCallout]
  )

  // ── drag helpers ──────────────────────────────────────────────────────────
  const startDrag = (e: React.MouseEvent, ann: Annotation) => {
    if (activeTool !== 'select') return
    e.stopPropagation()
    setSelectedAnnotationId(ann.id)
    onDragStart()   // snapshot history before the drag moves anything
    setDragState({ id: ann.id, startX: e.clientX, startY: e.clientY, origX: ann.x, origY: ann.y })
  }

  // ── resize helpers ─────────────────────────────────────────────────────────
  const startResize = (e: React.MouseEvent, ann: Annotation, handle: number) => {
    e.stopPropagation()
    e.preventDefault()
    onDragStart()   // snapshot history before resize
    const w = 'width' in ann ? (ann as any).width : 0
    const h = 'height' in ann ? (ann as any).height : 0
    setResizeState({
      id: ann.id, handle,
      startX: e.clientX, startY: e.clientY,
      origX: ann.x, origY: ann.y,
      origW: w, origH: h,
    })
  }

  // ── render resize handles ──────────────────────────────────────────────────
  const renderResizeHandles = (ann: Annotation) => {
    if (selectedAnnotationId !== ann.id) return null
    if (!RESIZABLE_TYPES.has(ann.type)) return null
    const a = ann as any
    const w = a.width ?? 0
    const h = a.height ?? 0
    const size = 8
    const half = size / 2
    // Positions: NW=0, N=1, NE=2, W=3, E=4, SW=5, S=6, SE=7
    const handles = [
      { idx: 0, x: a.x - half, y: a.y - half, cursor: 'nw-resize' },
      { idx: 1, x: a.x + w / 2 - half, y: a.y - half, cursor: 'n-resize' },
      { idx: 2, x: a.x + w - half, y: a.y - half, cursor: 'ne-resize' },
      { idx: 3, x: a.x - half, y: a.y + h / 2 - half, cursor: 'w-resize' },
      { idx: 4, x: a.x + w - half, y: a.y + h / 2 - half, cursor: 'e-resize' },
      { idx: 5, x: a.x - half, y: a.y + h - half, cursor: 'sw-resize' },
      { idx: 6, x: a.x + w / 2 - half, y: a.y + h - half, cursor: 's-resize' },
      { idx: 7, x: a.x + w - half, y: a.y + h - half, cursor: 'se-resize' },
    ]
    return (
      <>
        {/* Selection outline */}
        <div
          style={{
            position: 'absolute',
            left: a.x, top: a.y, width: w, height: h,
            border: '1.5px dashed #3b82f6',
            pointerEvents: 'none',
            zIndex: 9,
          }}
        />
        {/* Handles */}
        {handles.map((hp) => (
          <div
            key={hp.idx}
            style={{
              position: 'absolute',
              left: hp.x, top: hp.y,
              width: size, height: size,
              background: '#ffffff',
              border: '1.5px solid #3b82f6',
              cursor: hp.cursor,
              zIndex: 10,
            }}
            onMouseDown={(e) => startResize(e, ann, hp.idx)}
          />
        ))}
      </>
    )
  }

  // ── erase on click ────────────────────────────────────────────────────────
  const eraseAnn = (e: React.MouseEvent, id: string) => {
    if (activeTool !== 'eraser') return
    e.stopPropagation()
    onRemoveAnnotation(id)
  }

  // ── cursor ────────────────────────────────────────────────────────────────
  const cursor =
    activeTool === 'select' ? 'default'
      : activeTool === 'eraser' ? 'cell'
        : activeTool === 'text' ? 'text'
          : activeTool === 'stickynote' ? 'copy'
            : 'crosshair'

  return (
    <div
      className="absolute inset-0 select-none"
      style={{ width, height, cursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setDragState(null)
        setResizeState(null)
        setPolygonCursor(null)
        if (isDrawingRef.current) {
          isDrawingRef.current = false
          setRectPreview(null)
          setDrawPts([])
        }
      }}
    >
      {/* ── SVG layer: draws + shapes ──────────────────────────────────────── */}
      <svg
        className="absolute inset-0 pointer-events-none overflow-visible"
        width={width}
        height={height}
      >
        {/* Committed draw strokes */}
        {pageAnnotations.filter((a) => a.type === 'draw').map((ann) => {
          const d = ann as DrawAnnotation
          return (
            <path
              key={d.id}
              d={d.svgPath}
              stroke={d.color}
              strokeWidth={d.strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={d.opacity ?? 1}
              style={{ pointerEvents: activeTool === 'select' || activeTool === 'eraser' ? 'stroke' : 'none' }}
              onClick={(e) => {
                e.stopPropagation()
                if (activeTool === 'eraser') onRemoveAnnotation(d.id)
              }}
              onMouseDown={(e) => {
                if (activeTool === 'select') {
                  e.stopPropagation()
                  setSelectedAnnotationId(d.id)
                  onDragStart()
                  setDragState({ id: d.id, startX: e.clientX, startY: e.clientY, origX: d.x, origY: d.y })
                }
              }}
              className={activeTool === 'eraser' ? 'cursor-cell hover:opacity-50' : activeTool === 'select' ? 'cursor-move' : ''}
            />
          )
        })}
        {/* Live draw preview */}
        {drawPts.length > 1 && (
          <path
            d={buildSvgPath(drawPts)}
            stroke={toolOptions.color}
            strokeWidth={toolOptions.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
            style={{ pointerEvents: 'none' }}
          />
        )}
        {/* Committed shapes */}
        {pageAnnotations.filter((a) => a.type === 'shape').map((ann) => {
          const s = ann as ShapeAnnotation
          if (s.shape === 'polygon') return null // polygons rendered separately
          return (
            <g
              key={s.id}
              opacity={s.opacity ?? 1}
              style={{ pointerEvents: activeTool === 'select' || activeTool === 'eraser' ? 'auto' : 'none', cursor: activeTool === 'eraser' ? 'cell' : activeTool === 'select' ? 'move' : 'default' }}
              onMouseDown={(e) => {
                if (activeTool === 'select') {
                  e.stopPropagation()
                  setSelectedAnnotationId(s.id)
                  onDragStart()
                  setDragState({ id: s.id, startX: e.clientX, startY: e.clientY, origX: s.x, origY: s.y })
                }
              }}
              onClick={(e) => { e.stopPropagation(); if (activeTool === 'eraser') onRemoveAnnotation(s.id) }}
            >
              {renderShapeSVG(s.shape as 'rect' | 'ellipse' | 'line' | 'arrow', s.x, s.y, s.width, s.height, s.color, s.strokeWidth)}
            </g>
          )
        })}
        {/* Live shape preview */}
        {rectPreview && ['rect', 'ellipse', 'line', 'arrow'].includes(activeTool) && (
          <g style={{ pointerEvents: 'none' }}>
            {renderShapeSVG(
              activeTool as 'rect' | 'ellipse' | 'line' | 'arrow',
              rectPreview.x, rectPreview.y, rectPreview.w, rectPreview.h,
              toolOptions.color, toolOptions.strokeWidth, true
            )}
          </g>
        )}

        {/* Committed polygons */}
        {pageAnnotations.filter((a) => a.type === 'polygon').map((ann) => {
          const p = ann as PolygonAnnotation
          const pointsStr = p.points.map((pt) => `${pt.x},${pt.y}`).join(' ')
          return (
            <polygon
              key={p.id}
              points={pointsStr}
              stroke={p.color}
              strokeWidth={p.strokeWidth}
              fill="none"
              opacity={p.opacity ?? 1}
              strokeLinejoin="round"
              style={{ pointerEvents: activeTool === 'select' || activeTool === 'eraser' ? 'auto' : 'none', cursor: activeTool === 'eraser' ? 'cell' : activeTool === 'select' ? 'move' : 'default' }}
              onMouseDown={(e) => {
                if (activeTool === 'select') {
                  e.stopPropagation()
                  setSelectedAnnotationId(p.id)
                  onDragStart()
                  setDragState({ id: p.id, startX: e.clientX, startY: e.clientY, origX: p.x, origY: p.y })
                }
              }}
              onClick={(e) => { e.stopPropagation(); if (activeTool === 'eraser') onRemoveAnnotation(p.id) }}
            />
          )
        })}

        {/* Live polygon preview */}
        {activeTool === 'polygon' && polygonPts.length > 0 && (
          <g style={{ pointerEvents: 'none' }}>
            {/* Solid lines between placed points */}
            <polyline
              points={polygonPts.map((pt) => `${pt.x},${pt.y}`).join(' ')}
              stroke={toolOptions.color}
              strokeWidth={toolOptions.strokeWidth}
              fill="none"
              opacity={0.7}
              strokeLinejoin="round"
            />
            {/* Dashed line from last point to cursor */}
            {polygonCursor && (
              <>
                <line
                  x1={polygonPts[polygonPts.length - 1].x}
                  y1={polygonPts[polygonPts.length - 1].y}
                  x2={polygonCursor.x}
                  y2={polygonCursor.y}
                  stroke={toolOptions.color}
                  strokeWidth={toolOptions.strokeWidth}
                  strokeDasharray="6 3"
                  opacity={0.5}
                />
                {/* Dashed line from cursor back to first point (closing preview) */}
                {polygonPts.length >= 2 && (
                  <line
                    x1={polygonCursor.x}
                    y1={polygonCursor.y}
                    x2={polygonPts[0].x}
                    y2={polygonPts[0].y}
                    stroke={toolOptions.color}
                    strokeWidth={toolOptions.strokeWidth}
                    strokeDasharray="4 4"
                    opacity={0.3}
                  />
                )}
              </>
            )}
            {/* Dots at each placed vertex */}
            {polygonPts.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r={3} fill={toolOptions.color} opacity={0.8} />
            ))}
          </g>
        )}

        {/* Committed callouts */}
        {pageAnnotations.filter((a) => a.type === 'callout').map((ann) => {
          const ca = ann as CalloutAnnotation
          const r = 8 // corner radius
          // Build rounded rect + triangle tail as a single path
          const { x, y, width: bw, height: bh, tailX, tailY } = ca
          // Tail attachment points on bottom edge
          const tAttachL = Math.max(x + r, Math.min(x + bw / 2 - 10, tailX - 10))
          const tAttachR = Math.min(x + bw - r, Math.max(x + bw / 2 + 10, tailX + 10))
          const pathD = [
            `M ${x + r} ${y}`,
            `L ${x + bw - r} ${y}`,
            `Q ${x + bw} ${y} ${x + bw} ${y + r}`,
            `L ${x + bw} ${y + bh - r}`,
            `Q ${x + bw} ${y + bh} ${x + bw - r} ${y + bh}`,
            `L ${tAttachR} ${y + bh}`,
            `L ${tailX} ${tailY}`,
            `L ${tAttachL} ${y + bh}`,
            `L ${x + r} ${y + bh}`,
            `Q ${x} ${y + bh} ${x} ${y + bh - r}`,
            `L ${x} ${y + r}`,
            `Q ${x} ${y} ${x + r} ${y}`,
            'Z',
          ].join(' ')
          return (
            <g
              key={ca.id}
              opacity={ca.opacity ?? 1}
              style={{ pointerEvents: activeTool === 'select' || activeTool === 'eraser' ? 'auto' : 'none', cursor: activeTool === 'eraser' ? 'cell' : activeTool === 'select' ? 'move' : 'default' }}
              onMouseDown={(e) => {
                if (activeTool === 'select') {
                  e.stopPropagation()
                  setSelectedAnnotationId(ca.id)
                  onDragStart()
                  setDragState({ id: ca.id, startX: e.clientX, startY: e.clientY, origX: ca.x, origY: ca.y })
                }
              }}
              onClick={(e) => { e.stopPropagation(); if (activeTool === 'eraser') onRemoveAnnotation(ca.id) }}
            >
              <path d={pathD} stroke={ca.color} strokeWidth={2} fill={ca.color + '18'} strokeLinejoin="round" />
            </g>
          )
        })}

        {/* Live callout preview */}
        {rectPreview && activeTool === 'callout' && (
          <g style={{ pointerEvents: 'none' }}>
            {(() => {
              const { x, y, w: bw, h: bh } = rectPreview
              const r = 8
              const tailX = x + bw / 2
              const tailY = y + bh + 30
              const tAttachL = Math.max(x + r, tailX - 10)
              const tAttachR = Math.min(x + bw - r, tailX + 10)
              const pathD = [
                `M ${x + r} ${y}`,
                `L ${x + bw - r} ${y}`,
                `Q ${x + bw} ${y} ${x + bw} ${y + r}`,
                `L ${x + bw} ${y + bh - r}`,
                `Q ${x + bw} ${y + bh} ${x + bw - r} ${y + bh}`,
                `L ${tAttachR} ${y + bh}`,
                `L ${tailX} ${tailY}`,
                `L ${tAttachL} ${y + bh}`,
                `L ${x + r} ${y + bh}`,
                `Q ${x} ${y + bh} ${x} ${y + bh - r}`,
                `L ${x} ${y + r}`,
                `Q ${x} ${y} ${x + r} ${y}`,
                'Z',
              ].join(' ')
              return <path d={pathD} stroke={toolOptions.color} strokeWidth={2} fill={toolOptions.color + '18'} opacity={0.6} strokeDasharray="6 3" strokeLinejoin="round" />
            })()}
          </g>
        )}
      </svg>

      {/* ── Div-based annotations ─────────────────────────────────────────── */}

      {/* Whiteout */}
      {pageAnnotations.filter((a) => a.type === 'whiteout').map((ann) => {
        const w = ann as WhiteoutAnnotation
        return (
          <div
            key={w.id}
            style={{ position: 'absolute', left: w.x, top: w.y, width: w.width, height: w.height, background: '#ffffff', cursor: activeTool === 'eraser' ? 'cell' : activeTool === 'select' ? 'move' : 'default' }}
            onMouseDown={(e) => { eraseAnn(e, w.id); startDrag(e, ann) }}
            title={activeTool === 'eraser' ? 'Click to remove' : 'Drag to move'}
          />
        )
      })}

      {/* Highlight / Underline / Strikethrough */}
      {pageAnnotations.filter((a) => a.type === 'highlight').map((ann) => {
        const h = ann as HighlightAnnotation
        const style = h.markupStyle ?? 'highlight'
        const annOpacity = h.opacity ?? 0.35
        if (style === 'underline') {
          return (
            <div
              key={h.id}
              style={{
                position: 'absolute', left: h.x, top: h.y, width: h.width, height: h.height,
                cursor: activeTool === 'eraser' ? 'cell' : activeTool === 'select' ? 'move' : 'default',
                borderBottom: `2px solid ${h.color}`,
                opacity: annOpacity,
                boxSizing: 'border-box',
              }}
              onMouseDown={(e) => { eraseAnn(e, h.id); startDrag(e, ann) }}
              title={activeTool === 'eraser' ? 'Click to remove' : 'Drag to move'}
            />
          )
        }
        if (style === 'strikethrough') {
          return (
            <div
              key={h.id}
              style={{
                position: 'absolute', left: h.x, top: h.y, width: h.width, height: h.height,
                cursor: activeTool === 'eraser' ? 'cell' : activeTool === 'select' ? 'move' : 'default',
                opacity: annOpacity,
                display: 'flex', alignItems: 'center',
              }}
              onMouseDown={(e) => { eraseAnn(e, h.id); startDrag(e, ann) }}
              title={activeTool === 'eraser' ? 'Click to remove' : 'Drag to move'}
            >
              <div style={{ width: '100%', height: 2, backgroundColor: h.color }} />
            </div>
          )
        }
        // Default: highlight
        return (
          <div
            key={h.id}
            style={{ position: 'absolute', left: h.x, top: h.y, width: h.width, height: h.height, backgroundColor: h.color, opacity: annOpacity, cursor: activeTool === 'eraser' ? 'cell' : activeTool === 'select' ? 'move' : 'default' }}
            onMouseDown={(e) => { eraseAnn(e, h.id); startDrag(e, ann) }}
            title={activeTool === 'eraser' ? 'Click to remove' : 'Drag to move'}
          />
        )
      })}

      {/* Live highlight / underline / strikethrough / whiteout preview */}
      {rectPreview && (activeTool === 'highlight' || activeTool === 'underline' || activeTool === 'strikethrough' || activeTool === 'whiteout') && (
        <div
          style={{
            position: 'absolute',
            left: rectPreview.x, top: rectPreview.y,
            width: rectPreview.w, height: rectPreview.h,
            backgroundColor: activeTool === 'highlight' ? toolOptions.color : activeTool === 'whiteout' ? '#ffffff' : 'transparent',
            opacity: activeTool === 'highlight' ? (toolOptions.opacity ?? 0.35) : activeTool === 'whiteout' ? 0.8 : (toolOptions.opacity ?? 1),
            border: '1.5px dashed #888',
            pointerEvents: 'none',
            ...(activeTool === 'underline' ? { borderBottom: `2px solid ${toolOptions.color}` } : {}),
            ...(activeTool === 'strikethrough' ? { display: 'flex', alignItems: 'center' } : {}),
          }}
        >
          {activeTool === 'strikethrough' && (
            <div style={{ width: '100%', height: 2, backgroundColor: toolOptions.color }} />
          )}
        </div>
      )}

      {/* Stamps */}
      {pageAnnotations.filter((a) => a.type === 'stamp').map((ann) => {
        const s = ann as StampAnnotation
        return (
          <div
            key={s.id}
            style={{
              position: 'absolute', left: s.x, top: s.y,
              fontSize: s.fontSize, color: s.color, fontWeight: 'bold',
              lineHeight: 1, whiteSpace: 'nowrap',
              cursor: activeTool === 'eraser' ? 'cell' : activeTool === 'select' ? 'move' : 'default',
              userSelect: 'none',
            }}
            onMouseDown={(e) => { eraseAnn(e, s.id); startDrag(e, ann) }}
            title={activeTool === 'eraser' ? 'Click to remove' : 'Drag to move'}
          >
            {s.text}
          </div>
        )
      })}

      {/* Sticky Notes */}
      {pageAnnotations.filter((a) => a.type === 'stickynote').map((ann) => {
        const sn = ann as StickyNoteAnnotation
        const snOpacity = sn.opacity ?? 1
        return (
          <div key={sn.id} style={{ position: 'absolute', left: sn.x, top: sn.y, zIndex: 5 }}>
            {sn.expanded ? (
              <div
                style={{
                  width: 200, minHeight: 120,
                  background: sn.color + '22',
                  border: `2px solid ${sn.color}`,
                  borderRadius: 6,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  display: 'flex', flexDirection: 'column',
                  opacity: snOpacity,
                }}
                onMouseDown={(e) => { e.stopPropagation(); eraseAnn(e, sn.id); startDrag(e, ann) }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '3px 6px',
                  background: sn.color + '44',
                  borderRadius: '4px 4px 0 0',
                  cursor: activeTool === 'select' ? 'move' : 'default',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#333' }}>Note</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // Collapse: if text is empty, just collapse
                      onUpdateAnnotation(sn.id, { expanded: false } as Partial<Annotation>)
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 14, lineHeight: 1, padding: '0 2px', color: '#666',
                    }}
                    title="Collapse"
                  >
                    x
                  </button>
                </div>
                <textarea
                  value={sn.text}
                  onChange={(e) => {
                    e.stopPropagation()
                    onUpdateAnnotation(sn.id, { text: e.target.value } as Partial<Annotation>)
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onBlur={() => {
                    if (!sn.text.trim()) {
                      onUpdateAnnotation(sn.id, { expanded: false } as Partial<Annotation>)
                    }
                  }}
                  style={{
                    flex: 1, resize: 'none', border: 'none', outline: 'none',
                    background: 'transparent', padding: '4px 6px',
                    fontSize: 12, lineHeight: 1.4, color: '#333',
                    minHeight: 80,
                  }}
                  placeholder="Type note..."
                  autoFocus
                />
              </div>
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  if (activeTool === 'eraser') {
                    onRemoveAnnotation(sn.id)
                    return
                  }
                  onUpdateAnnotation(sn.id, { expanded: true } as Partial<Annotation>)
                }}
                onMouseDown={(e) => { e.stopPropagation(); if (activeTool === 'select') startDrag(e, ann) }}
                style={{
                  width: 24, height: 24,
                  background: sn.color,
                  borderRadius: 3,
                  cursor: activeTool === 'eraser' ? 'cell' : 'pointer',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                  opacity: snOpacity,
                }}
                title={sn.text || 'Click to expand note'}
              >
                {/* Corner fold */}
                <div style={{
                  position: 'absolute', top: 0, right: 0,
                  width: 8, height: 8,
                  background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.15) 50%)',
                  borderRadius: '0 3px 0 0',
                }} />
                <span style={{ fontSize: 12, lineHeight: 1 }}>📝</span>
              </div>
            )}
          </div>
        )
      })}

      {/* Callout text overlays */}
      {pageAnnotations.filter((a) => a.type === 'callout').map((ann) => {
        const ca = ann as CalloutAnnotation
        return (
          <div
            key={`callout-text-${ca.id}`}
            style={{
              position: 'absolute',
              left: ca.x + 6,
              top: ca.y + 4,
              width: ca.width - 12,
              height: ca.height - 8,
              fontSize: ca.fontSize,
              color: ca.color,
              lineHeight: 1.3,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              pointerEvents: activeTool === 'select' ? 'auto' : 'none',
              cursor: activeTool === 'select' ? 'pointer' : 'default',
              userSelect: 'none',
              wordBreak: 'break-word',
            }}
            onDoubleClick={(e) => {
              if (activeTool !== 'select') return
              e.stopPropagation()
              const newText = window.prompt('Edit callout text:', ca.text)
              if (newText !== null) onUpdateAnnotation(ca.id, { text: newText } as Partial<Annotation>)
            }}
            title={activeTool === 'select' ? 'Double-click to edit text' : ''}
          >
            {ca.text || (pendingCalloutId === ca.id ? '' : '')}
          </div>
        )
      })}

      {/* Callout pending text input */}
      {pendingCalloutId && (() => {
        const ca = pageAnnotations.find((a) => a.id === pendingCalloutId) as CalloutAnnotation | undefined
        if (!ca) return null
        return (
          <textarea
            style={{
              position: 'absolute',
              left: ca.x + 6,
              top: ca.y + 4,
              width: ca.width - 12,
              height: ca.height - 8,
              fontSize: ca.fontSize,
              color: ca.color,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              textAlign: 'center',
              lineHeight: 1.3,
              zIndex: 10,
              overflow: 'hidden',
              padding: 0,
            }}
            value={ca.text}
            onChange={(e) => onUpdateAnnotation(ca.id, { text: e.target.value } as Partial<Annotation>)}
            onBlur={() => setPendingCalloutId(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setPendingCalloutId(null); e.preventDefault() }
              if (e.key === 'Enter' && !e.shiftKey) { setPendingCalloutId(null); e.preventDefault() }
            }}
            placeholder="Type here..."
            autoFocus
          />
        )
      })()}

      {/* Text annotations */}
      {pageAnnotations.filter((a) => a.type === 'text').map((ann) => {
        const t = ann as TextAnnotation
        return (
          <div
            key={t.id}
            style={{
              position: 'absolute', left: t.x, top: t.y,
              fontSize: t.fontSize, color: t.color,
              cursor: activeTool === 'eraser' ? 'cell' : activeTool === 'select' ? 'move' : 'default',
              userSelect: 'none', whiteSpace: 'pre-wrap', lineHeight: 1.3,
              outline: activeTool === 'select' ? '1px dashed rgba(99,102,241,0.4)' : 'none',
              padding: 2,
            }}
            onMouseDown={(e) => { eraseAnn(e, t.id); startDrag(e, ann) }}
            onDoubleClick={(e) => {
              if (activeTool !== 'select') return
              e.stopPropagation()
              const newText = window.prompt('Edit text:', t.text)
              if (newText !== null) onUpdateAnnotation(t.id, { text: newText } as Partial<Annotation>)
            }}
            title={activeTool === 'eraser' ? 'Click to remove' : 'Double-click to edit · Drag to move'}
          >
            {t.text}
          </div>
        )
      })}

      {/* Signatures */}
      {pageAnnotations.filter((a) => a.type === 'signature').map((ann) => {
        const s = ann as SignatureAnnotation
        return (
          <img
            key={s.id}
            src={s.dataUrl}
            alt="signature"
            draggable={false}
            style={{
              position: 'absolute', left: s.x, top: s.y, width: s.width, height: s.height,
              cursor: activeTool === 'eraser' ? 'cell' : activeTool === 'select' ? 'move' : 'default',
              outline: activeTool === 'select' ? '1px dashed rgba(99,102,241,0.4)' : 'none',
            }}
            onMouseDown={(e) => { eraseAnn(e, s.id); startDrag(e, ann) }}
            title={activeTool === 'eraser' ? 'Click to remove' : 'Drag to move'}
          />
        )
      })}

      {/* ── Resize handles for selected annotation ──────────────────────── */}
      {activeTool === 'select' && selectedAnnotationId && pageAnnotations.map((ann) => (
        <React.Fragment key={`handles-${ann.id}`}>
          {renderResizeHandles(ann)}
        </React.Fragment>
      ))}

      {/* ── Pending text input ────────────────────────────────────────────── */}
      {pendingText && (
        <textarea
          ref={textareaRef}
          value={pendingText.value}
          onChange={(e) => setPendingText({ ...pendingText, value: e.target.value })}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setPendingText(null); e.preventDefault() }
            if (e.key === 'Enter' && !e.shiftKey) { commitText(); e.preventDefault() }
          }}
          style={{
            position: 'absolute',
            left: pendingText.x,
            top: pendingText.y,
            fontSize: toolOptions.fontSize,
            color: toolOptions.color,
            minWidth: 120,
            minHeight: toolOptions.fontSize * 1.6,
            background: 'rgba(255,255,255,0.15)',
            border: `1.5px solid ${toolOptions.color}`,
            borderRadius: 2,
            outline: 'none',
            resize: 'both',
            padding: '2px 4px',
            lineHeight: 1.3,
            zIndex: 10,
            overflow: 'hidden',
          }}
          placeholder="Type text, Enter to confirm"
          rows={1}
          autoFocus
        />
      )}
    </div>
  )
}
