import { useState, useCallback, useRef, useEffect } from 'react'
import { Shape, BoxShape, ConnShape, Tool, Style, Background, DEFAULT_STYLE } from './types'
import { getPortPosition } from './renderer'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../services/api'

// ── Persistence types ──────────────────────────────────────────────────────

export interface SavedDiagram {
  id: string
  name: string
  shapes: Shape[]
  background: Background
  createdAt: string
  updatedAt: string
}

interface StoredData {
  diagrams: SavedDiagram[]
  activeId: string | null
}

const STORAGE_KEY = 'toolzy_diagrams'

function loadStorage(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw) as StoredData
      if (Array.isArray(data.diagrams)) return data
    }
  } catch { /* ignore */ }
  return { diagrams: [], activeId: null }
}

function saveStorage(data: StoredData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* ignore quota errors */ }
}

function generateId(): string {
  return `d${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ── Editor hook ────────────────────────────────────────────────────────────

let _seq = 0
export function nextId() { return `s${++_seq}` }

export function useEditor() {
  const { isAuthenticated } = useAuth()

  // Load initial state from localStorage
  const initialData = useRef(loadStorage())

  const [diagrams, setDiagrams] = useState<SavedDiagram[]>(initialData.current.diagrams)
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(initialData.current.activeId)

  // Find the active diagram's shapes for initial state
  const activeDiagram = initialData.current.diagrams.find(d => d.id === initialData.current.activeId)

  const [shapes, setShapes] = useState<Shape[]>(activeDiagram?.shapes ?? [])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE)
  const [background, setBackground] = useState<Background>(activeDiagram?.background ?? 'dots')
  const [gridSnap, setGridSnap] = useState(false)

  // In-memory clipboard for copy/paste
  const clipboardRef = useRef<Shape[]>([])

  // Undo / Redo stacks
  const pastRef   = useRef<Shape[][]>([])
  const futureRef = useRef<Shape[][]>([])

  const snapshot = (prev: Shape[]) => {
    pastRef.current.push(JSON.parse(JSON.stringify(prev)))
    if (pastRef.current.length > 100) pastRef.current.shift()
    futureRef.current = []
  }

  // ── Debounced auto-save ──────────────────────────────────────────────────

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!activeDiagramId) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      setDiagrams(prev => {
        const now = new Date().toISOString()
        const updated = prev.map(d =>
          d.id === activeDiagramId
            ? { ...d, shapes, background, updatedAt: now }
            : d
        )
        saveStorage({ diagrams: updated, activeId: activeDiagramId })
        return updated
      })
    }, 500)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [shapes, background, activeDiagramId])

  // ── API sync ────────────────────────────────────────────────────────────

  const apiSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from server on mount when authenticated
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    api.getDiagrams().then((serverDiagrams: SavedDiagram[]) => {
      if (cancelled) return
      if (!Array.isArray(serverDiagrams) || serverDiagrams.length === 0) return
      setDiagrams(prev => {
        const serverMap = new Map(serverDiagrams.map(d => [d.id, d]))
        const merged: SavedDiagram[] = []
        const seenIds = new Set<string>()
        for (const d of serverDiagrams) {
          merged.push(d)
          seenIds.add(d.id)
        }
        for (const d of prev) {
          if (!seenIds.has(d.id)) merged.push(d)
        }
        const activeId = activeDiagramId ?? merged[0]?.id ?? null
        const active = merged.find(d => d.id === activeId)
        if (active) {
          setShapes(active.shapes)
          setBackground(active.background)
          setActiveDiagramId(activeId)
        }
        saveStorage({ diagrams: merged, activeId })
        return merged
      })
    }).catch(() => { /* offline: use localStorage */ })
    return () => { cancelled = true }
  }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced API sync on diagram changes
  useEffect(() => {
    if (!isAuthenticated || !activeDiagramId) return
    if (apiSyncTimerRef.current) clearTimeout(apiSyncTimerRef.current)
    apiSyncTimerRef.current = setTimeout(() => {
      const diagram = diagrams.find(d => d.id === activeDiagramId)
      if (!diagram) return
      api.updateDiagram(diagram.id, diagram).catch(() => {
        api.createDiagram(diagram.name, diagram).catch(() => { /* offline */ })
      })
    }, 1500)
    return () => { if (apiSyncTimerRef.current) clearTimeout(apiSyncTimerRef.current) }
  }, [diagrams, activeDiagramId, isAuthenticated])

  // ── Diagram CRUD ─────────────────────────────────────────────────────────

  const newDiagram = useCallback((name?: string) => {
    const id = generateId()
    const now = new Date().toISOString()
    const diagram: SavedDiagram = {
      id,
      name: name || 'Untitled',
      shapes: [],
      background: 'dots',
      createdAt: now,
      updatedAt: now,
    }
    setDiagrams(prev => {
      const updated = [...prev, diagram]
      saveStorage({ diagrams: updated, activeId: id })
      return updated
    })
    setActiveDiagramId(id)
    setShapes([])
    setBackground('dots')
    setSelectedIds([])
    pastRef.current = []
    futureRef.current = []
  }, [])

  const loadDiagram = useCallback((id: string) => {
    // Before switching, flush current diagram state
    if (activeDiagramId) {
      setDiagrams(prev => {
        const now = new Date().toISOString()
        const flushed = prev.map(d =>
          d.id === activeDiagramId
            ? { ...d, shapes, background, updatedAt: now }
            : d
        )
        // Now load the target
        const target = flushed.find(d => d.id === id)
        if (target) {
          setShapes(target.shapes)
          setBackground(target.background)
        }
        saveStorage({ diagrams: flushed, activeId: id })
        return flushed
      })
    } else {
      setDiagrams(prev => {
        const target = prev.find(d => d.id === id)
        if (target) {
          setShapes(target.shapes)
          setBackground(target.background)
        }
        saveStorage({ diagrams: prev, activeId: id })
        return prev
      })
    }
    setActiveDiagramId(id)
    setSelectedIds([])
    pastRef.current = []
    futureRef.current = []
  }, [activeDiagramId, shapes, background])

  const deleteDiagram = useCallback((id: string) => {
    setDiagrams(prev => {
      const updated = prev.filter(d => d.id !== id)
      let newActiveId: string | null = null

      if (id === activeDiagramId) {
        // Switch to another diagram, or clear
        if (updated.length > 0) {
          const target = updated[0]
          newActiveId = target.id
          setShapes(target.shapes)
          setBackground(target.background)
        } else {
          setShapes([])
          setBackground('dots')
        }
        setSelectedIds([])
        pastRef.current = []
        futureRef.current = []
        setActiveDiagramId(newActiveId)
      } else {
        newActiveId = activeDiagramId
      }

      saveStorage({ diagrams: updated, activeId: newActiveId })
      return updated
    })
  }, [activeDiagramId])

  const renameDiagram = useCallback((id: string, name: string) => {
    setDiagrams(prev => {
      const updated = prev.map(d =>
        d.id === id ? { ...d, name, updatedAt: new Date().toISOString() } : d
      )
      saveStorage({ diagrams: updated, activeId: activeDiagramId })
      return updated
    })
  }, [activeDiagramId])

  const saveDiagram = useCallback(() => {
    if (!activeDiagramId) return
    setDiagrams(prev => {
      const now = new Date().toISOString()
      const updated = prev.map(d =>
        d.id === activeDiagramId
          ? { ...d, shapes, background, updatedAt: now }
          : d
      )
      saveStorage({ diagrams: updated, activeId: activeDiagramId })
      return updated
    })
  }, [activeDiagramId, shapes, background])

  const getDiagrams = useCallback(() => {
    return diagrams
  }, [diagrams])

  // ── Mutations ─────────────────────────────────────────────────────────

  const addShape = useCallback((shape: Shape) => {
    setShapes(prev => { snapshot(prev); return [...prev, shape] })
    setSelectedIds([shape.id])
  }, [])

  const updateShape = useCallback((id: string, patch: Partial<Shape>) => {
    setShapes(prev => {
      snapshot(prev)
      return prev.map(s => s.id === id ? { ...s, ...patch } as Shape : s)
    })
  }, [])

  /**
   * Update connector endpoints that are attached to any of the moved shapes.
   * This recalculates x1,y1 or x2,y2 from the current port position.
   * Does NOT create a new undo snapshot (it's part of the move operation).
   */
  const updateConnectorEndpoints = useCallback((movedIds: string[], shapesArr: Shape[]): Shape[] => {
    const movedSet = new Set(movedIds)
    return shapesArr.map(s => {
      if (s.type !== 'arrow' && s.type !== 'dashed-arrow' && s.type !== 'line') return s
      const conn = s as ConnShape
      let changed = false
      let x1 = conn.x1, y1 = conn.y1, x2 = conn.x2, y2 = conn.y2
      if (conn.startAttach && movedSet.has(conn.startAttach.shapeId)) {
        const target = shapesArr.find(sh => sh.id === conn.startAttach!.shapeId) as BoxShape | undefined
        if (target) {
          const pos = getPortPosition(target, conn.startAttach.port)
          x1 = pos.x; y1 = pos.y; changed = true
        }
      }
      if (conn.endAttach && movedSet.has(conn.endAttach.shapeId)) {
        const target = shapesArr.find(sh => sh.id === conn.endAttach!.shapeId) as BoxShape | undefined
        if (target) {
          const pos = getPortPosition(target, conn.endAttach.port)
          x2 = pos.x; y2 = pos.y; changed = true
        }
      }
      if (!changed) return s
      return { ...conn, x1, y1, x2, y2 }
    })
  }, [])

  const moveShape = useCallback((id: string, dx: number, dy: number) => {
    setShapes(prev => {
      snapshot(prev)
      const moved = prev.map(s => {
        if (s.id !== id) return s
        if (s.type === 'pen')
          return { ...s, points: s.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) }
        if (s.type === 'arrow' || s.type === 'dashed-arrow' || s.type === 'line')
          return {
            ...s, x1: s.x1+dx, y1: s.y1+dy, x2: s.x2+dx, y2: s.y2+dy,
            cx: s.cx !== undefined ? s.cx+dx : undefined,
            cy: s.cy !== undefined ? s.cy+dy : undefined,
          }
        if (s.type === 'text')
          return { ...s, x: s.x + dx, y: s.y + dy }
        return { ...s, x: (s as { x: number }).x + dx, y: (s as { y: number }).y + dy } as Shape
      })
      return updateConnectorEndpoints([id], moved)
    })
  }, [updateConnectorEndpoints])

  /** Move multiple shapes at once by (dx, dy) */
  const moveShapes = useCallback((ids: string[], dx: number, dy: number) => {
    setShapes(prev => {
      snapshot(prev)
      const idSet = new Set(ids)
      const moved = prev.map(s => {
        if (!idSet.has(s.id)) return s
        if (s.type === 'pen')
          return { ...s, points: s.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) }
        if (s.type === 'arrow' || s.type === 'dashed-arrow' || s.type === 'line')
          return {
            ...s, x1: s.x1+dx, y1: s.y1+dy, x2: s.x2+dx, y2: s.y2+dy,
            cx: s.cx !== undefined ? s.cx+dx : undefined,
            cy: s.cy !== undefined ? s.cy+dy : undefined,
          }
        if (s.type === 'text')
          return { ...s, x: s.x + dx, y: s.y + dy }
        return { ...s, x: (s as { x: number }).x + dx, y: (s as { y: number }).y + dy } as Shape
      })
      return updateConnectorEndpoints(ids, moved)
    })
  }, [updateConnectorEndpoints])

  const deleteShape = useCallback((id: string) => {
    setShapes(prev => { snapshot(prev); return prev.filter(s => s.id !== id) })
    setSelectedIds(prev => prev.filter(sid => sid !== id))
  }, [])

  const deleteSelected = useCallback(() => {
    setSelectedIds(ids => {
      if (ids.length > 0) {
        const idSet = new Set(ids)
        setShapes(prev => { snapshot(prev); return prev.filter(s => !idSet.has(s.id)) })
      }
      return []
    })
  }, [])

  /** Deep-clone selected shapes into the in-memory clipboard */
  const copySelected = useCallback(() => {
    setSelectedIds(ids => {
      if (ids.length > 0) {
        const idSet = new Set(ids)
        const selected = shapes.filter(s => idSet.has(s.id))
        clipboardRef.current = JSON.parse(JSON.stringify(selected))
      }
      return ids
    })
  }, [shapes])

  /** Paste clipboard shapes with new IDs, offset by +20px each axis */
  const pasteClipboard = useCallback(() => {
    const clipped = clipboardRef.current
    if (clipped.length === 0) return
    const newShapes: Shape[] = clipped.map(s => {
      const clone = JSON.parse(JSON.stringify(s)) as Shape
      clone.id = nextId()
      if (clone.type === 'pen') {
        clone.points = clone.points.map(p => ({ ...p, x: p.x + 20, y: p.y + 20 }))
      } else if (clone.type === 'arrow' || clone.type === 'dashed-arrow' || clone.type === 'line') {
        clone.x1 += 20; clone.y1 += 20; clone.x2 += 20; clone.y2 += 20
        if (clone.cx !== undefined) clone.cx += 20
        if (clone.cy !== undefined) clone.cy += 20
      } else if (clone.type === 'text') {
        clone.x += 20; clone.y += 20
      } else {
        (clone as BoxShape).x += 20;
        (clone as BoxShape).y += 20
      }
      return clone
    })
    setShapes(prev => { snapshot(prev); return [...prev, ...newShapes] })
    setSelectedIds(newShapes.map(s => s.id))
    // Update clipboard to the new copies so repeated paste offsets further
    clipboardRef.current = JSON.parse(JSON.stringify(newShapes))
  }, [])

  /** Duplicate selected shapes in one step (copy + paste) */
  const duplicateSelected = useCallback(() => {
    const idSet = new Set<string>()
    // Read current selectedIds synchronously through a state updater
    setSelectedIds(ids => { ids.forEach(id => idSet.add(id)); return ids })
    // We need the shapes at this moment
    const selected = shapes.filter(s => idSet.has(s.id))
    if (selected.length === 0) return
    clipboardRef.current = JSON.parse(JSON.stringify(selected))
    // Now paste
    const clipped = clipboardRef.current
    const newShapes: Shape[] = clipped.map(s => {
      const clone = JSON.parse(JSON.stringify(s)) as Shape
      clone.id = nextId()
      if (clone.type === 'pen') {
        clone.points = clone.points.map(p => ({ ...p, x: p.x + 20, y: p.y + 20 }))
      } else if (clone.type === 'arrow' || clone.type === 'dashed-arrow' || clone.type === 'line') {
        clone.x1 += 20; clone.y1 += 20; clone.x2 += 20; clone.y2 += 20
        if (clone.cx !== undefined) clone.cx += 20
        if (clone.cy !== undefined) clone.cy += 20
      } else if (clone.type === 'text') {
        clone.x += 20; clone.y += 20
      } else {
        (clone as BoxShape).x += 20;
        (clone as BoxShape).y += 20
      }
      return clone
    })
    setShapes(prev => { snapshot(prev); return [...prev, ...newShapes] })
    setSelectedIds(newShapes.map(s => s.id))
    clipboardRef.current = JSON.parse(JSON.stringify(newShapes))
  }, [shapes])

  const bringToFront = useCallback((ids: string[]) => {
    setShapes(prev => {
      snapshot(prev)
      const targets = prev.filter(s => ids.includes(s.id))
      const rest = prev.filter(s => !ids.includes(s.id))
      return [...rest, ...targets]
    })
  }, [])

  const sendToBack = useCallback((ids: string[]) => {
    setShapes(prev => {
      snapshot(prev)
      const targets = prev.filter(s => ids.includes(s.id))
      const rest = prev.filter(s => !ids.includes(s.id))
      return [...targets, ...rest]
    })
  }, [])

  const moveUp = useCallback((ids: string[]) => {
    setShapes(prev => {
      snapshot(prev)
      const arr = [...prev]
      // Process from end to start so items don't collide
      for (let i = arr.length - 2; i >= 0; i--) {
        if (ids.includes(arr[i].id) && !ids.includes(arr[i + 1].id)) {
          ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
        }
      }
      return arr
    })
  }, [])

  const moveDown = useCallback((ids: string[]) => {
    setShapes(prev => {
      snapshot(prev)
      const arr = [...prev]
      // Process from start to end so items don't collide
      for (let i = 1; i < arr.length; i++) {
        if (ids.includes(arr[i].id) && !ids.includes(arr[i - 1].id)) {
          ;[arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]
        }
      }
      return arr
    })
  }, [])

  const undo = useCallback(() => {
    const prev = pastRef.current.pop()
    if (!prev) return
    setShapes(curr => { futureRef.current.push(JSON.parse(JSON.stringify(curr))); return prev })
    setSelectedIds([])
  }, [])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (!next) return
    setShapes(curr => { pastRef.current.push(JSON.parse(JSON.stringify(curr))); return next })
    setSelectedIds([])
  }, [])

  const clearAll = useCallback(() => {
    setShapes(prev => { snapshot(prev); return [] })
    setSelectedIds([])
  }, [])

  /** Replace all shapes with imported data (from JSON import) */
  const loadShapes = useCallback((imported: Shape[]) => {
    setShapes(prev => { snapshot(prev); return imported })
    setSelectedIds([])
  }, [])

  const patchStyle = useCallback((patch: Partial<Style>) => {
    setStyle(s => ({ ...s, ...patch }))
  }, [])

  return {
    shapes, selectedIds, tool, style, background,
    setSelectedIds, setTool, patchStyle, setBackground,
    addShape, updateShape, moveShape, moveShapes, deleteShape, deleteSelected,
    copySelected, pasteClipboard, duplicateSelected,
    undo, redo, clearAll, loadShapes,
    get canUndo() { return pastRef.current.length > 0 },
    get canRedo() { return futureRef.current.length > 0 },
    gridSnap, setGridSnap,
    bringToFront, sendToBack, moveUp, moveDown,
    // Diagram management
    diagrams,
    activeDiagramId,
    newDiagram,
    loadDiagram,
    deleteDiagram,
    renameDiagram,
    saveDiagram,
    getDiagrams,
  }
}
