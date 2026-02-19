import { useReducer, useState, useCallback, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Annotation, ToolType, PageDimensions, ToolOptions } from '../../types/pdf'
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load PDF')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── annotation mutations (all go through dispatch) ─────────────────────────

  const addHighlight = useCallback(
    (pageIndex: number, x: number, y: number, width: number, height: number, color?: string) => {
      dispatch({ type: 'ADD', ann: { id: generateId(), type: 'highlight', pageIndex, x, y, width, height, color: color ?? toolOptions.color } })
    },
    [toolOptions.color]
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
      dispatch({ type: 'ADD', ann: { id: generateId(), type: 'draw', pageIndex, svgPath, color: toolOptions.color, strokeWidth: toolOptions.strokeWidth, ...bbox } })
    },
    [toolOptions.color, toolOptions.strokeWidth]
  )

  const addShape = useCallback(
    (pageIndex: number, shape: 'rect' | 'ellipse' | 'line' | 'arrow', x: number, y: number, width: number, height: number) => {
      dispatch({ type: 'ADD', ann: { id: generateId(), type: 'shape', pageIndex, shape, x, y, width, height, color: toolOptions.color, strokeWidth: toolOptions.strokeWidth } })
    },
    [toolOptions.color, toolOptions.strokeWidth]
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
    addHighlight, addText, addSignature, addDraw, addShape, addWhiteout, addStamp,
    updateAnnotation, removeAnnotation, startDragHistory,
    setPageDims,
    originalBytesRef, pageDimsRef,
    reset,
  }
}
