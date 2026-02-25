import {
  useRef, useEffect, useCallback, useState,
  forwardRef, useImperativeHandle,
} from 'react'
import { Shape, Tool, Style, Viewport, Pt, BoxShape, ConnShape, Background, PortAttach } from './types'
import {
  renderShape, renderGrid, getBBox, hitTest, buildPreview,
  getHandlePositions, applyResize, applyMoveOffset, HANDLE_SIZE,
  renderRubberBand, findNearestPort, renderPorts, getPortPosition,
} from './renderer'
import { nextId } from './useEditor'
import { snapPoint, snapToGrid } from './gridUtils'

// ── Public handle ─────────────────────────────────────────────────────────

export interface CanvasHandle {
  exportPNG: () => void
  resetView: () => void
}

// ── Internal state shapes ─────────────────────────────────────────────────

interface TextEditState {
  shapeId: string | null
  wx: number; wy: number   // world coords (for new text shape)
  sx: number; sy: number   // screen coords (for textarea position)
  initial: string
}

interface ResizeState {
  shapeId: string
  handleIdx: number
  origX: number; origY: number; origW: number; origH: number
  startWx: number; startWy: number
}

// ── Constants ─────────────────────────────────────────────────────────────

const ERASER_RADIUS = 18  // world units

// Returns true if any point of a pen stroke is within `radius` of (wx, wy)
function penStrokeHitsEraser(points: { x: number; y: number }[], wx: number, wy: number, radius: number) {
  const r2 = radius * radius
  for (let i = 0; i < points.length; i++) {
    const dx = points[i].x - wx, dy = points[i].y - wy
    if (dx * dx + dy * dy <= r2) return true
    // Also check midpoints between consecutive points for smoother detection
    if (i < points.length - 1) {
      const mx = (points[i].x + points[i + 1].x) / 2
      const my = (points[i].y + points[i + 1].y) / 2
      const mdx = mx - wx, mdy = my - wy
      if (mdx * mdx + mdy * mdy <= r2) return true
    }
  }
  return false
}

// ── Cursor helpers ────────────────────────────────────────────────────────

const HANDLE_CURSORS = [
  'nw-resize', 'n-resize', 'ne-resize',
  'w-resize',                'e-resize',
  'sw-resize', 's-resize', 'se-resize',
]

// ── Props ─────────────────────────────────────────────────────────────────

interface Props {
  shapes: Shape[]
  selectedIds: string[]
  tool: Tool
  style: Style
  background: Background
  gridSnap?: boolean
  onAddShape:    (s: Shape) => void
  onMoveShape:   (id: string, dx: number, dy: number) => void
  onMoveShapes:  (ids: string[], dx: number, dy: number) => void
  onSelect:      (ids: string[]) => void
  onDeleteShape: (id: string) => void
  onDeleteSelected: () => void
  onUpdateShape: (id: string, patch: Partial<Shape>) => void
  onToolChange:  (t: Tool) => void
  onUndo: () => void
  onRedo: () => void
  onCopySelected: () => void
  onPasteClipboard: () => void
  onDuplicateSelected: () => void
}

// ── Coordinate helpers ────────────────────────────────────────────────────

function s2w(sx: number, sy: number, vp: Viewport): [number, number] {
  return [(sx - vp.tx) / vp.scale, (sy - vp.ty) / vp.scale]
}

function getPos(canvas: HTMLCanvasElement, e: React.PointerEvent | React.MouseEvent) {
  const r = canvas.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

function isBoxShape(s: Shape): s is BoxShape {
  return ['rect','roundrect','diamond','ellipse','parallelogram','star','triangle','hexagon'].includes(s.type)
}

function isConnShape(s: Shape): s is ConnShape {
  return s.type === 'arrow' || s.type === 'dashed-arrow' || s.type === 'line'
}

// ── Component ─────────────────────────────────────────────────────────────

const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(
  {
    shapes, selectedIds, tool, style, background,
    gridSnap,
    onAddShape, onMoveShape, onMoveShapes, onSelect, onDeleteShape, onDeleteSelected,
    onUpdateShape, onToolChange, onUndo, onRedo,
    onCopySelected, onPasteClipboard, onDuplicateSelected,
  },
  ref,
) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Viewport (ref — updated without re-render)
  const vpRef = useRef<Viewport>({ tx: 0, ty: 0, scale: 1 })

  // Mirror props into refs so pointer handlers never have stale closures
  const shapesRef   = useRef(shapes)
  const selectedRef = useRef<string[]>(selectedIds)
  const toolRef     = useRef(tool)
  const styleRef      = useRef(style)
  const backgroundRef = useRef(background)
  useEffect(() => { shapesRef.current     = shapes     }, [shapes])
  useEffect(() => { selectedRef.current  = selectedIds }, [selectedIds])
  useEffect(() => {
    toolRef.current = tool
    if (tool !== 'eraser') eraserPosRef.current = null  // clear cursor preview
  }, [tool])
  useEffect(() => { styleRef.current     = style      }, [style])
  useEffect(() => { backgroundRef.current = background }, [background])

  const gridSnapRef = useRef(gridSnap ?? false)
  useEffect(() => { gridSnapRef.current = gridSnap ?? false }, [gridSnap])

  // ── Drawing refs ──────────────────────────────────────────────────────
  const penPtsRef    = useRef<Pt[]>([])
  const drawStartRef = useRef<{ wx: number; wy: number } | null>(null)
  const previewRef   = useRef<Shape | null>(null)

  // ── Smart connector refs ────────────────────────────────────────────
  const connStartAttachRef = useRef<PortAttach | null>(null)
  const connHoverPortRef   = useRef<{ shapeId: string; port: string; x: number; y: number } | null>(null)

  // ── Drag-to-move (supports multi-select) ─────────────────────────────
  const dragRef      = useRef<{ ids: string[]; wx: number; wy: number; moved: boolean } | null>(null)
  const dragOffRef   = useRef({ dx: 0, dy: 0 })

  // ── Rubber-band selection ──────────────────────────────────────────────
  const rubberRef    = useRef<{ wx: number; wy: number } | null>(null)  // start point in world
  const rubberEndRef = useRef<{ wx: number; wy: number } | null>(null)  // current end point

  // ── Resize ────────────────────────────────────────────────────────────
  const resizeRef     = useRef<ResizeState | null>(null)
  const resizeLiveRef = useRef<Shape | null>(null)

  // ── Control-point drag (curved connectors) ────────────────────────────
  const ctrlRef     = useRef<{ shapeId: string } | null>(null)
  const ctrlLiveRef = useRef<ConnShape | null>(null)

  // ── Pan ───────────────────────────────────────────────────────────────
  const panRef      = useRef<{ sx: number; sy: number; tx: number; ty: number } | null>(null)
  const spaceRef    = useRef(false)

  // ── Eraser ────────────────────────────────────────────────────────────
  const eraserRef   = useRef<{ wx: number; wy: number } | null>(null)  // null = not erasing
  const eraserPosRef = useRef<{ wx: number; wy: number } | null>(null) // cursor position for preview

  // ── Pinch zoom ────────────────────────────────────────────────────────
  const ptrsRef  = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null)

  // Text editing overlay (only thing that needs React state)
  const [textEdit, setTextEdit] = useState<TextEditState | null>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  // Mirror textEdit into a ref so pointer handlers can read it without stale closures
  const textEditRef    = useRef<TextEditState | null>(null)
  useEffect(() => { textEditRef.current = textEdit }, [textEdit])
  // When the user clicks a new canvas position while a textarea is open,
  // pointerdown fires BEFORE blur. We store the next edit here so that
  // commitText (triggered by the blur) can apply it instead of setting null.
  const nextTextEditRef = useRef<TextEditState | null>(null)

  // ── Render ────────────────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const ctx  = canvas.getContext('2d')!
    const W    = canvas.width  / dpr
    const H    = canvas.height / dpr
    const vp   = vpRef.current

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f8fafc'
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    ctx.save()
    ctx.translate(vp.tx, vp.ty)
    ctx.scale(vp.scale, vp.scale)

    renderGrid(ctx, vp, W, H, backgroundRef.current)

    const selSet = new Set(selectedRef.current)
    const dragIds = dragRef.current?.moved ? new Set(dragRef.current.ids) : null

    const allShapes = shapesRef.current

    for (const s of allShapes) {
      let draw: Shape = s
      if (resizeRef.current?.shapeId === s.id && resizeLiveRef.current) {
        draw = resizeLiveRef.current
      } else if (ctrlRef.current?.shapeId === s.id && ctrlLiveRef.current) {
        draw = ctrlLiveRef.current
      } else if (dragIds && dragIds.has(s.id)) {
        draw = applyMoveOffset(s, dragOffRef.current.dx, dragOffRef.current.dy)
      }
      renderShape(ctx, draw, selSet.has(draw.id), undefined, allShapes)
    }

    if (previewRef.current) renderShape(ctx, previewRef.current, false, undefined, allShapes)

    // ── Port indicators during connector tool usage ──
    const isConnTool = toolRef.current === 'arrow' || toolRef.current === 'dashed-arrow' || toolRef.current === 'line'
    if (isConnTool && drawStartRef.current) {
      // Show ports on shape being hovered near
      if (connHoverPortRef.current) {
        const hoverShape = allShapes.find(s => s.id === connHoverPortRef.current!.shapeId)
        if (hoverShape && isBoxShape(hoverShape)) {
          renderPorts(ctx, hoverShape, vp)
        }
      }
      // Also show ports on the shape the start is attached to
      if (connStartAttachRef.current) {
        const startShape = allShapes.find(s => s.id === connStartAttachRef.current!.shapeId)
        if (startShape && isBoxShape(startShape)) {
          renderPorts(ctx, startShape, vp)
        }
      }
    }

    // ── Rubber-band selection rectangle ──
    if (rubberRef.current && rubberEndRef.current) {
      const r0 = rubberRef.current, r1 = rubberEndRef.current
      const rx = Math.min(r0.wx, r1.wx), ry = Math.min(r0.wy, r1.wy)
      const rw = Math.abs(r1.wx - r0.wx), rh = Math.abs(r1.wy - r0.wy)
      renderRubberBand(ctx, rx, ry, rw, rh)
    }

    // ── Eraser cursor circle ──
    if (toolRef.current === 'eraser' && eraserPosRef.current) {
      const { wx: ex, wy: ey } = eraserPosRef.current
      const r = ERASER_RADIUS
      ctx.save()
      ctx.beginPath()
      ctx.arc(ex, ey, r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(239,68,68,0.10)'
      ctx.fill()
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 1.5 / vp.scale
      ctx.setLineDash([3, 2])
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()
  }, [])

  // ── ResizeObserver ────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current
    const canvas    = canvasRef.current
    if (!container || !canvas) return
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1
      const { width, height } = container.getBoundingClientRect()
      canvas.width  = Math.round(width  * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width  = `${width}px`
      canvas.style.height = `${height}px`
      render()
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [render])

  useEffect(() => { render() }, [shapes, selectedIds, background, tool, render])

  // ── Keyboard ──────────────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === textareaRef.current) return
      if (e.key === ' ') { spaceRef.current = true; e.preventDefault(); return }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedRef.current.length > 0) { onDeleteSelected(); e.preventDefault() }
        return
      }
      // Copy / Paste / Duplicate
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'c') { onCopySelected(); e.preventDefault(); return }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'v') { onPasteClipboard(); e.preventDefault(); return }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'd') { onDuplicateSelected(); e.preventDefault(); return }
      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { onUndo(); e.preventDefault(); return }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { onRedo(); e.preventDefault() }
    }
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === ' ') spaceRef.current = false }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [onDeleteSelected, onUndo, onRedo, onCopySelected, onPasteClipboard, onDuplicateSelected])

  // ── Exposed imperative handle ─────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    exportPNG() {
      const canvas = canvasRef.current!
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a'); a.href = url; a.download = 'diagram.png'; a.click()
    },
    resetView() { vpRef.current = { tx: 0, ty: 0, scale: 1 }; render() },
  }), [render])

  // ── Pinch helpers ─────────────────────────────────────────────────────

  const pinchData = () => {
    const pts = [...ptrsRef.current.values()]
    if (pts.length < 2) return null
    return {
      dist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
      cx: (pts[0].x + pts[1].x) / 2,
      cy: (pts[0].y + pts[1].y) / 2,
    }
  }

  // ── Commit helper: called after any shape is finalized ────────────────

  const commitShape = useCallback((shape: Shape) => {
    onAddShape(shape)
    onToolChange('select')   // auto-switch so selection handles are usable immediately
    onSelect([shape.id])
  }, [onAddShape, onToolChange, onSelect])

  // ── Pointer down ──────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current!
    canvas.setPointerCapture(e.pointerId)

    const { x: sx, y: sy } = getPos(canvas, e)
    ptrsRef.current.set(e.pointerId, { x: sx, y: sy })

    // ── Two-finger: start pinch + pan ──
    if (ptrsRef.current.size === 2) {
      penPtsRef.current = []; drawStartRef.current = null; previewRef.current = null; dragRef.current = null
      const pd = pinchData()!
      pinchRef.current = pd
      panRef.current = { sx: pd.cx, sy: pd.cy, tx: vpRef.current.tx, ty: vpRef.current.ty }
      return
    }

    const [wx, wy] = s2w(sx, sy, vpRef.current)
    const t = toolRef.current

    // ── Textarea is open: block all canvas interactions ────────────────
    // e.preventDefault() above stops the browser's natural blur, so we
    // must explicitly blur the textarea ourselves.  commitText (onBlur)
    // will then commit the current text and, if in text tool, open a new
    // textarea at the clicked position.
    if (textEditRef.current) {
      if (t === 'text') {
        nextTextEditRef.current = { shapeId: null, wx, wy, sx, sy, initial: '' }
      }
      textareaRef.current?.blur()   // ← triggers commitText via onBlur
      return
    }

    // ── Middle-button or Space → pan ──
    if (e.button === 1 || spaceRef.current) {
      panRef.current = { sx, sy, tx: vpRef.current.tx, ty: vpRef.current.ty }
      return
    }
    if (t === 'pan') { panRef.current = { sx, sy, tx: vpRef.current.tx, ty: vpRef.current.ty }; return }

    // ── Select tool ───────────────────────────────────────────────────
    if (t === 'select') {
      const selIds = selectedRef.current
      const selIdSet = new Set(selIds)

      // 1. Control-point hit on curved connector (only when single selected)
      if (selIds.length === 1) {
        const selShape = shapesRef.current.find(s => s.id === selIds[0]) ?? null
        if (selShape && isConnShape(selShape) && selShape.cx !== undefined && selShape.cy !== undefined) {
          const hitR = Math.max(10, 12 / vpRef.current.scale)
          if (Math.hypot(wx - selShape.cx, wy - selShape.cy) <= hitR) {
            ctrlRef.current  = { shapeId: selShape.id }
            ctrlLiveRef.current = { ...selShape }
            return
          }
        }
      }

      // 2. Resize handle hit on box shape (only when single selected)
      if (selIds.length === 1) {
        const selShape = shapesRef.current.find(s => s.id === selIds[0]) ?? null
        if (selShape && isBoxShape(selShape)) {
          const bb = getBBox(selShape)
          if (bb) {
            const hitR = Math.max(HANDLE_SIZE + 3, 10 / vpRef.current.scale)
            const handles = getHandlePositions(bb)
            for (let i = 0; i < handles.length; i++) {
              const [hx, hy] = handles[i]
              if (Math.abs(wx - hx) <= hitR && Math.abs(wy - hy) <= hitR) {
                resizeRef.current = {
                  shapeId: selShape.id, handleIdx: i,
                  origX: bb.x, origY: bb.y, origW: bb.w, origH: bb.h,
                  startWx: wx, startWy: wy,
                }
                resizeLiveRef.current = { ...selShape }
                canvas.style.cursor = HANDLE_CURSORS[i]
                return
              }
            }
          }
        }
      }

      // 3. Shape body hit → drag / select
      const hit = [...shapesRef.current].reverse().find(s => hitTest(s, wx, wy))
      if (hit) {
        const isShift = (e as React.PointerEvent).shiftKey
        if (isShift) {
          // Shift+click: toggle selection
          if (selIdSet.has(hit.id)) {
            onSelect(selIds.filter(id => id !== hit.id))
          } else {
            onSelect([...selIds, hit.id])
          }
        } else {
          // If clicking an already-selected shape in a multi-select, keep selection for drag
          if (!selIdSet.has(hit.id)) {
            onSelect([hit.id])
          }
          // Start drag for all currently selected shapes (or the newly selected one)
          const dragTargets = selIdSet.has(hit.id) ? selIds : [hit.id]
          dragRef.current = { ids: dragTargets, wx, wy, moved: false }
          dragOffRef.current = { dx: 0, dy: 0 }
        }
      } else {
        // Click on empty area: start rubber-band selection
        if (!(e as React.PointerEvent).shiftKey) {
          onSelect([])
        }
        rubberRef.current = { wx, wy }
        rubberEndRef.current = { wx, wy }
      }
      return
    }

    // ── Text tool ─────────────────────────────────────────────────────
    if (t === 'text') {
      onSelect([])   // clear any stale selection so style changes don't hit old shapes
      const next: TextEditState = { shapeId: null, wx, wy, sx, sy, initial: '' }
      if (textEdit) {
        // A textarea is already open. pointerdown fires before blur, so if we
        // call setTextEdit now the blur's commitText will overwrite it with null.
        // Instead, store the target and let commitText (on blur) apply it.
        nextTextEditRef.current = next
      } else {
        setTextEdit(next)
        setTimeout(() => textareaRef.current?.focus(), 20)
      }
      return
    }

    // ── Eraser tool ───────────────────────────────────────────────────
    if (t === 'eraser') {
      eraserRef.current = { wx, wy }
      // Immediately erase any pen strokes under the starting point
      const toDelete = shapesRef.current
        .filter(s => s.type === 'pen' && penStrokeHitsEraser(s.points, wx, wy, ERASER_RADIUS))
        .map(s => s.id)
      toDelete.forEach(id => onDeleteShape(id))
      render()
      return
    }

    // ── Pen tool ──────────────────────────────────────────────────────
    if (t === 'pen') {
      penPtsRef.current = [{ x: wx, y: wy, pressure: e.pressure > 0 ? e.pressure : 0.5 }]
      return
    }

    // ── Box / connector tools ─────────────────────────────────────────
    const isConnTool = t === 'arrow' || t === 'dashed-arrow' || t === 'line'

    if (isConnTool) {
      // Check if clicking near a port for smart connector start
      const nearPort = findNearestPort(shapesRef.current, wx, wy)
      if (nearPort) {
        connStartAttachRef.current = { shapeId: nearPort.shapeId, port: nearPort.port }
        drawStartRef.current = { wx: nearPort.x, wy: nearPort.y }
      } else {
        connStartAttachRef.current = null
        if (gridSnapRef.current) {
          const snapped = snapPoint(wx, wy)
          drawStartRef.current = { wx: snapped.x, wy: snapped.y }
        } else {
          drawStartRef.current = { wx, wy }
        }
      }
    } else {
      connStartAttachRef.current = null
      if (gridSnapRef.current) {
        const snapped = snapPoint(wx, wy)
        drawStartRef.current = { wx: snapped.x, wy: snapped.y }
      } else {
        drawStartRef.current = { wx, wy }
      }
    }
  }, [onSelect])

  // ── Pointer move ──────────────────────────────────────────────────────

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current!
    const { x: sx, y: sy } = getPos(canvas, e)
    ptrsRef.current.set(e.pointerId, { x: sx, y: sy })

    // ── Two-finger pinch zoom ──
    if (ptrsRef.current.size >= 2 && pinchRef.current) {
      const curr = pinchData()!
      const vp = vpRef.current
      const newScale = Math.max(0.08, Math.min(10, vp.scale * (curr.dist / pinchRef.current.dist)))
      const wx = (curr.cx - vp.tx) / vp.scale, wy = (curr.cy - vp.ty) / vp.scale
      vpRef.current = { scale: newScale, tx: curr.cx - wx * newScale, ty: curr.cy - wy * newScale }
      pinchRef.current = curr
      render(); return
    }

    // ── Pan ──
    if (panRef.current) {
      const { sx: ox, sy: oy, tx, ty } = panRef.current
      vpRef.current = { ...vpRef.current, tx: tx + sx - ox, ty: ty + sy - oy }
      render(); return
    }

    const [wx, wy] = s2w(sx, sy, vpRef.current)
    const t = toolRef.current

    // ── Eraser cursor position (always track when eraser tool) ──
    if (t === 'eraser') {
      eraserPosRef.current = { wx, wy }
      canvas.style.cursor = 'none'
      if (eraserRef.current) {
        // Active erasing: delete pen strokes under pointer
        const toDelete = shapesRef.current
          .filter(s => s.type === 'pen' && penStrokeHitsEraser(s.points, wx, wy, ERASER_RADIUS))
          .map(s => s.id)
        toDelete.forEach(id => onDeleteShape(id))
      }
      render(); return
    }

    // ── Control-point drag ──
    if (ctrlRef.current && ctrlLiveRef.current) {
      ctrlLiveRef.current = { ...ctrlLiveRef.current, cx: wx, cy: wy }
      canvas.style.cursor = 'crosshair'
      render(); return
    }

    // ── Resize ──
    if (resizeRef.current) {
      const { origX, origY, origW, origH, startWx, startWy, handleIdx, shapeId } = resizeRef.current
      const newDims = applyResize(handleIdx, origX, origY, origW, origH, wx - startWx, wy - startWy)
      const orig = shapesRef.current.find(s => s.id === shapeId)
      if (orig) resizeLiveRef.current = { ...orig, ...newDims } as Shape
      canvas.style.cursor = HANDLE_CURSORS[handleIdx]
      render(); return
    }

    // ── Select: hover cursor ──
    if (t === 'select') {
      const selIds = selectedRef.current

      // Check control point (single-select only)
      if (selIds.length === 1) {
        const selShape = shapesRef.current.find(s => s.id === selIds[0]) ?? null
        if (selShape && isConnShape(selShape) && selShape.cx !== undefined && selShape.cy !== undefined) {
          const hitR = Math.max(10, 12 / vpRef.current.scale)
          if (Math.hypot(wx - selShape.cx, wy - selShape.cy) <= hitR) {
            canvas.style.cursor = 'crosshair'; return
          }
        }
        // Check resize handles (single-select only)
        if (selShape && isBoxShape(selShape)) {
          const bb = getBBox(selShape)
          if (bb) {
            const hitR = Math.max(HANDLE_SIZE + 3, 10 / vpRef.current.scale)
            const handles = getHandlePositions(bb)
            for (let i = 0; i < handles.length; i++) {
              const [hx, hy] = handles[i]
              if (Math.abs(wx - hx) <= hitR && Math.abs(wy - hy) <= hitR) {
                canvas.style.cursor = HANDLE_CURSORS[i]; return
              }
            }
          }
        }
      }

      // Regular hover
      canvas.style.cursor = shapesRef.current.some(s => hitTest(s, wx, wy)) ? 'move' : 'default'
    }

    // ── Rubber-band selection ──
    if (t === 'select' && rubberRef.current) {
      rubberEndRef.current = { wx, wy }
      render(); return
    }

    // ── Drag-to-move (multi) ──
    if (t === 'select' && dragRef.current) {
      const dx = wx - dragRef.current.wx, dy = wy - dragRef.current.wy
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        dragRef.current.moved = true
        dragOffRef.current.dx += dx; dragOffRef.current.dy += dy
        dragRef.current.wx = wx; dragRef.current.wy = wy
      }
      render(); return
    }

    // ── Pen ── (skip points closer than 2px to reduce jitter)
    if (t === 'pen' && penPtsRef.current.length > 0) {
      const last = penPtsRef.current[penPtsRef.current.length - 1]
      if (Math.hypot(wx - last.x, wy - last.y) >= 2) {
        penPtsRef.current.push({ x: wx, y: wy, pressure: e.pressure > 0 ? e.pressure : 0.5 })
      }
      previewRef.current = { id: '_preview', type: 'pen', points: penPtsRef.current, style: styleRef.current }
      render(); return
    }

    // ── Box / connector preview ──
    if (drawStartRef.current) {
      const { wx: x0, wy: y0 } = drawStartRef.current
      let finalWx = wx, finalWy = wy

      const isConnTool = t === 'arrow' || t === 'dashed-arrow' || t === 'line'
      if (isConnTool) {
        // Check for port hover to snap endpoint
        const excludeId = connStartAttachRef.current?.shapeId
        const nearPort = findNearestPort(shapesRef.current, wx, wy, excludeId)
        if (nearPort) {
          connHoverPortRef.current = nearPort
          finalWx = nearPort.x
          finalWy = nearPort.y
        } else {
          connHoverPortRef.current = null
          if (gridSnapRef.current) {
            const snapped = snapPoint(wx, wy)
            finalWx = snapped.x
            finalWy = snapped.y
          }
        }
      } else {
        connHoverPortRef.current = null
        if (gridSnapRef.current) {
          const snapped = snapPoint(wx, wy)
          finalWx = snapped.x
          finalWy = snapped.y
        }
      }

      previewRef.current = buildPreview(t, x0, y0, finalWx, finalWy, styleRef.current)
      render()
    }
  }, [render, onDeleteShape])

  // ── Pointer up ────────────────────────────────────────────────────────

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current!
    const { x: sx, y: sy } = getPos(canvas, e)
    const [wx, wy] = s2w(sx, sy, vpRef.current)

    ptrsRef.current.delete(e.pointerId)
    if (ptrsRef.current.size < 2) pinchRef.current = null
    panRef.current = null
    eraserRef.current = null
    if (toolRef.current !== 'eraser') canvas.style.cursor = ''  // reset to CSS default

    // ── Commit control-point drag ──
    if (ctrlRef.current && ctrlLiveRef.current) {
      onUpdateShape(ctrlRef.current.shapeId, { cx: ctrlLiveRef.current.cx, cy: ctrlLiveRef.current.cy } as Partial<Shape>)
      ctrlRef.current = null; ctrlLiveRef.current = null
      render(); return
    }

    // ── Commit resize ──
    if (resizeRef.current && resizeLiveRef.current) {
      const live = resizeLiveRef.current as BoxShape
      onUpdateShape(resizeRef.current.shapeId, { x: live.x, y: live.y, w: live.w, h: live.h } as Partial<Shape>)
      resizeRef.current = null; resizeLiveRef.current = null
      render(); return
    }

    const t = toolRef.current

    // ── Commit rubber-band selection ──
    if (t === 'select' && rubberRef.current) {
      const r0 = rubberRef.current, r1 = rubberEndRef.current ?? r0
      const rx = Math.min(r0.wx, r1.wx), ry = Math.min(r0.wy, r1.wy)
      const rw = Math.abs(r1.wx - r0.wx), rh = Math.abs(r1.wy - r0.wy)
      // Only select if the rubber band is large enough (not just a click)
      if (rw > 3 || rh > 3) {
        const hits = shapesRef.current.filter(s => {
          const bb = getBBox(s)
          if (!bb) return false
          // Intersection test: shape bbox overlaps rubber-band rect
          return bb.x + bb.w >= rx && bb.x <= rx + rw &&
                 bb.y + bb.h >= ry && bb.y <= ry + rh
        }).map(s => s.id)
        onSelect(hits)
      }
      rubberRef.current = null; rubberEndRef.current = null
      render(); return
    }

    // ── Commit drag (multi) ──
    if (t === 'select' && dragRef.current) {
      if (dragRef.current.moved) {
        let { dx, dy } = dragOffRef.current
        if (gridSnapRef.current) {
          dx = snapToGrid(dx)
          dy = snapToGrid(dy)
        }
        if (dragRef.current.ids.length === 1) {
          onMoveShape(dragRef.current.ids[0], dx, dy)
        } else {
          onMoveShapes(dragRef.current.ids, dx, dy)
        }
      }
      dragRef.current = null; dragOffRef.current = { dx: 0, dy: 0 }
      render(); return
    }

    // ── Commit pen stroke ── (stay in pen mode, don't select the stroke)
    if (t === 'pen' && penPtsRef.current.length >= 2) {
      onAddShape({ id: nextId(), type: 'pen', points: [...penPtsRef.current], style: styleRef.current })
      penPtsRef.current = []; previewRef.current = null
      render(); return
    }
    penPtsRef.current = []

    // ── Commit box / connector ──
    if (drawStartRef.current) {
      const { wx: x0, wy: y0 } = drawStartRef.current
      let finalWx = wx, finalWy = wy
      const isConn = t === 'arrow' || t === 'dashed-arrow' || t === 'line'

      let endAttach: PortAttach | undefined
      if (isConn) {
        // Check if releasing near a port for smart connector end
        const excludeId = connStartAttachRef.current?.shapeId
        const nearPort = findNearestPort(shapesRef.current, wx, wy, excludeId)
        if (nearPort) {
          endAttach = { shapeId: nearPort.shapeId, port: nearPort.port }
          finalWx = nearPort.x
          finalWy = nearPort.y
        } else if (gridSnapRef.current) {
          const snapped = snapPoint(wx, wy)
          finalWx = snapped.x
          finalWy = snapped.y
        }
      } else if (gridSnapRef.current) {
        const snapped = snapPoint(wx, wy)
        finalWx = snapped.x
        finalWy = snapped.y
      }

      const shape = buildPreview(t, x0, y0, finalWx, finalWy, styleRef.current)
      if (shape) {
        const big = isConn ? Math.hypot(finalWx-x0, finalWy-y0) > 6 : Math.abs(finalWx-x0) > 6 || Math.abs(finalWy-y0) > 6
        if (big) {
          const newShape = { ...shape, id: nextId() } as Shape
          // Attach smart connector ports if applicable
          if (isConn) {
            const conn = newShape as ConnShape
            if (connStartAttachRef.current) conn.startAttach = connStartAttachRef.current
            if (endAttach) conn.endAttach = endAttach
          }
          commitShape(newShape)
        } else {
          onSelect([])   // click without drag → deselect
        }
      }
      drawStartRef.current = null; previewRef.current = null
      connStartAttachRef.current = null; connHoverPortRef.current = null
    }
  }, [onMoveShape, onMoveShapes, onSelect, onUpdateShape, commitShape, render])

  // ── Wheel zoom ────────────────────────────────────────────────────────

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    const sx = e.clientX - r.left, sy = e.clientY - r.top
    const factor = e.deltaY < 0 ? 1.12 : 0.89
    const vp = vpRef.current
    const newScale = Math.max(0.08, Math.min(10, vp.scale * factor))
    const wx = (sx - vp.tx) / vp.scale, wy = (sy - vp.ty) / vp.scale
    vpRef.current = { scale: newScale, tx: sx - wx * newScale, ty: sy - wy * newScale }
    render()
  }, [render])

  // ── Double-click: edit label ──────────────────────────────────────────

  const onDblClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const { x: sx, y: sy } = getPos(canvas, e)
    const [wx, wy] = s2w(sx, sy, vpRef.current)
    const hit = [...shapesRef.current].reverse().find(s => hitTest(s, wx, wy))
    if (hit && hit.type !== 'pen') {
      const bb = getBBox(hit)
      if (!bb) return
      const screenX = bb.x * vpRef.current.scale + vpRef.current.tx
      const screenY = bb.y * vpRef.current.scale + vpRef.current.ty
      setTextEdit({
        shapeId: hit.id, wx: bb.x, wy: bb.y, sx: screenX, sy: screenY,
        initial: (hit as { label?: string }).label ?? '',
      })
      setTimeout(() => { textareaRef.current?.focus(); textareaRef.current?.select() }, 20)
    }
  }, [])

  // ── Text commit ───────────────────────────────────────────────────────

  const commitText = useCallback((value: string) => {
    if (!textEdit) return
    const trimmed = value.trim()
    if (trimmed) {
      if (textEdit.shapeId) {
        onUpdateShape(textEdit.shapeId, { label: trimmed } as Partial<Shape>)
      } else {
        onAddShape({ id: nextId(), type: 'text', x: textEdit.wx, y: textEdit.wy, label: trimmed, style: styleRef.current })
      }
    }
    // If the user clicked a new canvas position while this textarea was open,
    // nextTextEditRef holds that position — apply it instead of clearing.
    const next = nextTextEditRef.current
    nextTextEditRef.current = null
    setTextEdit(next)
    if (next) {
      // defaultValue only sets the DOM value on first mount; React reuses
      // the same <textarea> element on position change, leaving the old text
      // in the DOM. Reset it directly so the new textarea appears empty.
      if (textareaRef.current) textareaRef.current.value = next.initial
      setTimeout(() => textareaRef.current?.focus(), 20)
    }
  }, [textEdit, onAddShape, onUpdateShape])

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden" style={{ touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ touchAction: 'none', display: 'block' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onDoubleClick={onDblClick}
      />

      {textEdit && (
        <textarea
          ref={textareaRef}
          defaultValue={textEdit.initial}
          placeholder="Type label…"
          rows={2}
          style={{
            position: 'absolute',
            left: Math.max(4, textEdit.sx), top: Math.max(4, textEdit.sy),
            minWidth: 140, fontSize: style.fontSize,
            color: style.stroke, fontFamily: 'system-ui, sans-serif',
            background: 'var(--surface, #fff)',
            border: '2px solid #3b82f6', borderRadius: 6,
            padding: '4px 8px', outline: 'none', resize: 'both', zIndex: 20,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
          onBlur={e => commitText(e.target.value)}
          onKeyDown={e => {
            e.stopPropagation()
            if (e.key === 'Escape') { setTextEdit(null); return }
            if (e.key === 'Enter' && !e.shiftKey) commitText((e.target as HTMLTextAreaElement).value)
          }}
        />
      )}
    </div>
  )
})

export default Canvas
