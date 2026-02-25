import { useReducer, useState, useCallback, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Annotation, ToolType, PageDimensions, ToolOptions, PageOp } from '../../types/pdf'
import { generateId } from '../../utils/ids'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

// ── history reducer ───────────────────────────────────────────────────────────

const MAX_HISTORY = 50

interface HistoryState {
  annotations: Annotation[]
  past: Annotation[][]   // undo stack  (oldest → newest)
  future: Annotation[][]  // redo stack  (most-recent-undone first)
}

type HistoryAction =
  | { type: 'ADD';        ann: Annotation }
  | { type: 'REMOVE';     id: string }
  | { type: 'UPDATE';     id: string; updates: Partial<Annotation> }
  | { type: 'DRAG_START' }               // snapshot before a drag begins
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET' }

function clamp<T>(arr: T[], max: number): T[] {
  return arr.length > max ? arr.slice(arr.length - max) : arr
}

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'ADD': {
      return {
        past: clamp([...state.past, state.annotations], MAX_HISTORY),
        future: [],
        annotations: [...state.annotations, action.ann],
      }
    }
    case 'REMOVE': {
      return {
        past: clamp([...state.past, state.annotations], MAX_HISTORY),
        future: [],
        annotations: state.annotations.filter((a) => a.id !== action.id),
      }
    }
    case 'UPDATE': {
      // No history snapshot — called on every mousemove during drag.
      // DRAG_START is responsible for capturing the pre-drag snapshot.
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === action.id ? { ...a, ...action.updates } as Annotation : a
        ),
      }
    }
    case 'DRAG_START': {
      // Capture current state into past before a drag/move begins.
      // If the user drags and then undoes, this restores the pre-drag position.
      return {
        ...state,
        past: clamp([...state.past, state.annotations], MAX_HISTORY),
        future: [],
      }
    }
    case 'UNDO': {
      if (state.past.length === 0) return state
      const past = state.past.slice()
      const previous = past.pop()!
      return {
        annotations: previous,
        past,
        future: [state.annotations, ...state.future].slice(0, MAX_HISTORY),
      }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      const future = state.future.slice()
      const next = future.shift()!
      return {
        annotations: next,
        past: clamp([...state.past, state.annotations], MAX_HISTORY),
        future,
      }
    }
    case 'RESET': {
      return { annotations: [], past: [], future: [] }
    }
  }
}

const INIT_HISTORY: HistoryState = { annotations: [], past: [], future: [] }

// ── tool options ──────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: ToolOptions = {
  color: '#f59e0b',
  strokeWidth: 2,
  fontSize: 16,
  stampSymbol: '✓',
  opacity: 1,
}

// ── hook ──────────────────────────────────────────────────────────────────────

export function usePDFEditor() {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [fileName, setFileName] = useState('')
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [history, dispatch] = useReducer(historyReducer, INIT_HISTORY)
  const [activeTool, setActiveTool] = useState<ToolType>('select')
  const [toolOptions, setToolOptionsState] = useState<ToolOptions>(DEFAULT_OPTIONS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const originalBytesRef = useRef<ArrayBuffer | null>(null)
  const pageDimsRef = useRef<PageDimensions[]>([])
  const [pageOperations, setPageOperations] = useState<PageOp[]>([])

  const { annotations, past, future } = history
  const canUndo = past.length > 0
  const canRedo = future.length > 0

  // ── tool options ────────────────────────────────────────────────────────────

  const setToolOptions = useCallback((patch: Partial<ToolOptions>) => {
    setToolOptionsState((prev) => ({ ...prev, ...patch }))
  }, [])

  // ── pdf loading ─────────────────────────────────────────────────────────────

  const loadPDF = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      const arrayBuffer = await file.arrayBuffer()
      originalBytesRef.current = arrayBuffer.slice(0)
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
      setPdfDoc(doc)
      setFileName(file.name)
      setNumPages(doc.numPages)
      setCurrentPage(1)
      dispatch({ type: 'RESET' })
      pageDimsRef.current = []
      setPageOperations([])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load PDF')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── annotation mutations (all go through dispatch) ─────────────────────────

  const addHighlight = useCallback(
    (pageIndex: number, x: number, y: number, width: number, height: number, color?: string) => {
      dispatch({ type: 'ADD', ann: { id: generateId(), type: 'highlight', pageIndex, x, y, width, height, color: color ?? toolOptions.color, markupStyle: 'highlight' as const, opacity: toolOptions.opacity } })
    },
    [toolOptions.color, toolOptions.opacity]
  )

  const addText = useCallback(
    (pageIndex: number, x: number, y: number, text: string, color?: string, fontSize?: number) => {
      if (!text.trim()) return
      dispatch({ type: 'ADD', ann: { id: generateId(), type: 'text', pageIndex, x, y, text, fontSize: fontSize ?? toolOptions.fontSize, color: color ?? toolOptions.color } })
    },
    [toolOptions.color, toolOptions.fontSize]
  )

  const addSignature = useCallback(
    (pageIndex: number, x: number, y: number, width: number, height: number, dataUrl: string) => {
      dispatch({ type: 'ADD', ann: { id: generateId(), type: 'signature', pageIndex, x, y, width, height, dataUrl } })
    },
    []
  )

  const addDraw = useCallback(
    (pageIndex: number, svgPath: string, bbox: { x: number; y: number; width: number; height: number }) => {
      dispatch({ type: 'ADD', ann: { id: generateId(), type: 'draw', pageIndex, svgPath, color: toolOptions.color, strokeWidth: toolOptions.strokeWidth, opacity: toolOptions.opacity, ...bbox } })
    },
    [toolOptions.color, toolOptions.strokeWidth, toolOptions.opacity]
  )

  const addShape = useCallback(
    (pageIndex: number, shape: 'rect' | 'ellipse' | 'line' | 'arrow', x: number, y: number, width: number, height: number) => {
      dispatch({ type: 'ADD', ann: { id: generateId(), type: 'shape', pageIndex, shape, x, y, width, height, color: toolOptions.color, strokeWidth: toolOptions.strokeWidth, opacity: toolOptions.opacity } })
    },
    [toolOptions.color, toolOptions.strokeWidth, toolOptions.opacity]
  )

  const addWhiteout = useCallback(
    (pageIndex: number, x: number, y: number, width: number, height: number) => {
      dispatch({ type: 'ADD', ann: { id: generateId(), type: 'whiteout', pageIndex, x, y, width, height } })
    },
    []
  )

  const addStamp = useCallback(
    (pageIndex: number, x: number, y: number) => {
      const text = toolOptions.stampSymbol === 'date'
        ? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : toolOptions.stampSymbol
      dispatch({ type: 'ADD', ann: { id: generateId(), type: 'stamp', pageIndex, x, y, text, color: toolOptions.color, fontSize: toolOptions.fontSize } })
    },
    [toolOptions]
  )

  const addStickyNote = useCallback(
    (pageIndex: number, x: number, y: number) => {
      dispatch({ type: 'ADD', ann: { id: generateId(), type: 'stickynote', pageIndex, x, y, text: '', color: toolOptions.color, expanded: true, opacity: toolOptions.opacity } })
    },
    [toolOptions.color, toolOptions.opacity]
  )

  const addUnderline = useCallback(
    (pageIndex: number, x: number, y: number, width: number, height: number) => {
      dispatch({ type: 'ADD', ann: { id: generateId(), type: 'highlight', pageIndex, x, y, width, height, color: toolOptions.color, markupStyle: 'underline' as const, opacity: toolOptions.opacity } })
    },
    [toolOptions.color, toolOptions.opacity]
  )

  const addStrikethrough = useCallback(
    (pageIndex: number, x: number, y: number, width: number, height: number) => {
      dispatch({ type: 'ADD', ann: { id: generateId(), type: 'highlight', pageIndex, x, y, width, height, color: toolOptions.color, markupStyle: 'strikethrough' as const, opacity: toolOptions.opacity } })
    },
    [toolOptions.color, toolOptions.opacity]
  )

  const addPolygon = useCallback(
    (pageIndex: number, points: { x: number; y: number }[]) => {
      if (points.length < 3) return
      const xs = points.map((p) => p.x)
      const ys = points.map((p) => p.y)
      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      const maxX = Math.max(...xs)
      const maxY = Math.max(...ys)
      dispatch({
        type: 'ADD',
        ann: {
          id: generateId(), type: 'polygon', pageIndex, points,
          color: toolOptions.color, strokeWidth: toolOptions.strokeWidth,
          opacity: toolOptions.opacity,
          x: minX, y: minY, width: maxX - minX, height: maxY - minY,
        },
      })
    },
    [toolOptions.color, toolOptions.strokeWidth, toolOptions.opacity]
  )

  const addCallout = useCallback(
    (pageIndex: number, x: number, y: number, width: number, height: number, tailX: number, tailY: number) => {
      dispatch({
        type: 'ADD',
        ann: {
          id: generateId(), type: 'callout', pageIndex,
          x, y, width, height, tailX, tailY,
          text: '', color: toolOptions.color,
          fontSize: toolOptions.fontSize, opacity: toolOptions.opacity,
        },
      })
    },
    [toolOptions.color, toolOptions.fontSize, toolOptions.opacity]
  )

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    dispatch({ type: 'UPDATE', id, updates })
  }, [])

  const removeAnnotation = useCallback((id: string) => {
    dispatch({ type: 'REMOVE', id })
  }, [])

  /** Call this when a drag/move begins so undo can restore the pre-drag position. */
  const startDragHistory = useCallback(() => {
    dispatch({ type: 'DRAG_START' })
  }, [])

  // ── page management ────────────────────────────────────────────────────────

  const rotatePage = useCallback((pageIndex: number, degrees: number) => {
    setPageOperations((prev) => [...prev, { type: 'rotate', pageIndex, degrees }])
  }, [])

  const deletePage = useCallback((pageIndex: number) => {
    setPageOperations((prev) => [...prev, { type: 'delete', pageIndex }])
    // Remove annotations on the deleted page and adjust indices for subsequent pages
    const annsOnPage = annotations.filter((a) => a.pageIndex === pageIndex)
    for (const a of annsOnPage) {
      dispatch({ type: 'REMOVE', id: a.id })
    }
    // Decrement pageIndex for annotations on pages after the deleted one
    for (const a of annotations) {
      if (a.pageIndex > pageIndex) {
        dispatch({ type: 'UPDATE', id: a.id, updates: { pageIndex: a.pageIndex - 1 } as Partial<Annotation> })
      }
    }
    // Adjust numPages
    setNumPages((n) => Math.max(1, n - 1))
    // Adjust current page if needed
    setCurrentPage((cp) => cp > numPages - 1 ? Math.max(1, numPages - 1) : cp)
  }, [annotations, numPages])

  const movePage = useCallback((from: number, to: number) => {
    if (from === to) return
    setPageOperations((prev) => [...prev, { type: 'move', from, to }])
    // Remap annotation page indices
    for (const a of annotations) {
      let pi = a.pageIndex
      if (pi === from) {
        pi = to
      } else if (from < to && pi > from && pi <= to) {
        pi = pi - 1
      } else if (from > to && pi >= to && pi < from) {
        pi = pi + 1
      }
      if (pi !== a.pageIndex) {
        dispatch({ type: 'UPDATE', id: a.id, updates: { pageIndex: pi } as Partial<Annotation> })
      }
    }
  }, [annotations])

  // ── undo / redo ─────────────────────────────────────────────────────────────

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])

  // ── page dims ───────────────────────────────────────────────────────────────

  const setPageDims = useCallback((pageIndex: number, dims: PageDimensions) => {
    pageDimsRef.current[pageIndex] = dims
  }, [])

  // ── reset ───────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setPdfDoc(null)
    setFileName('')
    setNumPages(0)
    dispatch({ type: 'RESET' })
    originalBytesRef.current = null
    pageDimsRef.current = []
    setPageOperations([])
  }, [])

  return {
    pdfDoc, fileName, numPages,
    currentPage, setCurrentPage,
    scale, setScale,
    annotations,
    canUndo, canRedo,
    undo, redo,
    activeTool, setActiveTool,
    toolOptions, setToolOptions,
    loading, error,
    loadPDF,
    addHighlight, addText, addSignature, addDraw, addShape, addWhiteout, addStamp, addStickyNote, addUnderline, addStrikethrough, addPolygon, addCallout,
    updateAnnotation, removeAnnotation, startDragHistory,
    setPageDims,
    originalBytesRef, pageDimsRef,
    reset,
    pageOperations, rotatePage, deletePage, movePage,
  }
}
