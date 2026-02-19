import { useRef, useState, useCallback, useEffect } from 'react'
import {
  Annotation, ToolType,
  TextAnnotation, SignatureAnnotation, DrawAnnotation, ShapeAnnotation,
  StampAnnotation, WhiteoutAnnotation, HighlightAnnotation,
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
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void
  onRemoveAnnotation: (id: string) => void
  /** Called once when the user starts dragging an annotation — used to snapshot history */
  onDragStart: () => void
}

// Tools that use drag-to-draw (rect preview)
const RECT_TOOLS = new Set<ToolType>(['highlight', 'whiteout', 'rect', 'ellipse', 'line', 'arrow'])
// Tools that use single click
const CLICK_TOOLS = new Set<ToolType>(['text', 'stamp', 'signature'])

export default function AnnotationLayer({
  pageIndex, width, height, scale,
  annotations, activeTool, toolOptions,
  onAddHighlight, onAddText, onAddSignature,
  onAddDraw, onAddShape, onAddWhiteout, onAddStamp,
  onUpdateAnnotation, onRemoveAnnotation, onDragStart,
}: AnnotationLayerProps) {
  // ── drawing state ─────────────────────────────────────────────────────────
  const [rectPreview, setRectPreview] = useState<Rect | null>(null)
  const [drawPts, setDrawPts] = useState<{ x: number; y: number }[]>([])
  const isDrawingRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })

  // ── text entry state ──────────────────────────────────────────────────────
  const [pendingText, setPendingText] = useState<PendingText | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── drag state ────────────────────────────────────────────────────────────
  const [dragState, setDragState] = useState<DragState | null>(null)

  const pageAnnotations = annotations.filter((a) => a.pageIndex === pageIndex)

  // Auto-focus textarea when pending text appears
  useEffect(() => {
    if (pendingText) textareaRef.current?.focus()
  }, [pendingText])

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
      if (activeTool === 'select') return
      if (activeTool === 'eraser') return   // eraser handled per-annotation
      e.preventDefault()

      // Commit any pending text first
      if (pendingText) { commitText(); return }

      const pos = relPos(e)

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
    },
    [activeTool, pendingText, commitText, pageIndex, onAddStamp, onAddSignature]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const pos = relPos(e)
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
    [activeTool, dragState, onUpdateAnnotation]
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setDragState(null)
      if (!isDrawingRef.current) return
      isDrawingRef.current = false
      const pos = relPos(e)

      if (RECT_TOOLS.has(activeTool) && rectPreview) {
        const { x, y, w, h } = rectPreview
        if (w > 4 && h > 4) {
          if (activeTool === 'highlight') onAddHighlight(pageIndex, x, y, w, h)
          else if (activeTool === 'whiteout') onAddWhiteout(pageIndex, x, y, w, h)
          else if (activeTool === 'rect') onAddShape(pageIndex, 'rect', x, y, w, h)
          else if (activeTool === 'ellipse') onAddShape(pageIndex, 'ellipse', x, y, w, h)
          else if (activeTool === 'line') onAddShape(pageIndex, 'line', x, y, w, h)
          else if (activeTool === 'arrow') onAddShape(pageIndex, 'arrow', x, y, w, h)
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
      onAddHighlight, onAddWhiteout, onAddShape, onAddDraw]
  )

  // ── drag helpers ──────────────────────────────────────────────────────────
  const startDrag = (e: React.MouseEvent, ann: Annotation) => {
    if (activeTool !== 'select') return
    e.stopPropagation()
    onDragStart()   // snapshot history before the drag moves anything
    setDragState({ id: ann.id, startX: e.clientX, startY: e.clientY, origX: ann.x, origY: ann.y })
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
              style={{ pointerEvents: activeTool === 'select' || activeTool === 'eraser' ? 'stroke' : 'none' }}
              onClick={(e) => { e.stopPropagation(); if (activeTool === 'eraser') onRemoveAnnotation(d.id) }}
              className={activeTool === 'eraser' ? 'cursor-cell hover:opacity-50' : ''}
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
          return (
            <g
              key={s.id}
              style={{ pointerEvents: activeTool === 'select' || activeTool === 'eraser' ? 'auto' : 'none', cursor: activeTool === 'eraser' ? 'cell' : activeTool === 'select' ? 'move' : 'default' }}
              onMouseDown={(e) => { if (activeTool === 'select') { e.stopPropagation(); setDragState({ id: s.id, startX: e.clientX, startY: e.clientY, origX: s.x, origY: s.y }) } }}
              onClick={(e) => { e.stopPropagation(); if (activeTool === 'eraser') onRemoveAnnotation(s.id) }}
            >
              {renderShapeSVG(s.shape, s.x, s.y, s.width, s.height, s.color, s.strokeWidth)}
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

      {/* Highlight */}
      {pageAnnotations.filter((a) => a.type === 'highlight').map((ann) => {
        const h = ann as HighlightAnnotation
        return (
          <div
            key={h.id}
            style={{ position: 'absolute', left: h.x, top: h.y, width: h.width, height: h.height, backgroundColor: h.color, opacity: 0.35, cursor: activeTool === 'eraser' ? 'cell' : activeTool === 'select' ? 'move' : 'default' }}
            onMouseDown={(e) => { eraseAnn(e, h.id); startDrag(e, ann) }}
            title={activeTool === 'eraser' ? 'Click to remove' : 'Drag to move'}
          />
        )
      })}

      {/* Live highlight / whiteout preview */}
      {rectPreview && (activeTool === 'highlight' || activeTool === 'whiteout') && (
        <div
          style={{
            position: 'absolute',
            left: rectPreview.x, top: rectPreview.y,
            width: rectPreview.w, height: rectPreview.h,
            backgroundColor: activeTool === 'highlight' ? toolOptions.color : '#ffffff',
            opacity: activeTool === 'highlight' ? 0.35 : 0.8,
            border: '1.5px dashed #888',
            pointerEvents: 'none',
          }}
        />
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
