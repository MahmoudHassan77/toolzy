import { useState, useCallback, useRef } from 'react'
import { Shape, Tool, Style, DEFAULT_STYLE } from './types'

let _seq = 0
export function nextId() { return `s${++_seq}` }

export function useEditor() {
  const [shapes, setShapes] = useState<Shape[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE)

  // Undo / Redo stacks
  const pastRef   = useRef<Shape[][]>([])
  const futureRef = useRef<Shape[][]>([])

  const snapshot = (prev: Shape[]) => {
    pastRef.current.push(JSON.parse(JSON.stringify(prev)))
    if (pastRef.current.length > 100) pastRef.current.shift()
    futureRef.current = []
  }

  // ── Mutations ─────────────────────────────────────────────────────────

  const addShape = useCallback((shape: Shape) => {
    setShapes(prev => { snapshot(prev); return [...prev, shape] })
    setSelectedId(shape.id)
  }, [])

  const updateShape = useCallback((id: string, patch: Partial<Shape>) => {
    setShapes(prev => {
      snapshot(prev)
      return prev.map(s => s.id === id ? { ...s, ...patch } as Shape : s)
    })
  }, [])

  const moveShape = useCallback((id: string, dx: number, dy: number) => {
    setShapes(prev => {
      snapshot(prev)
      return prev.map(s => {
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
    })
  }, [])

  const deleteShape = useCallback((id: string) => {
    setShapes(prev => { snapshot(prev); return prev.filter(s => s.id !== id) })
    setSelectedId(prev => prev === id ? null : prev)
  }, [])

  const deleteSelected = useCallback(() => {
    setSelectedId(id => {
      if (id) {
        setShapes(prev => { snapshot(prev); return prev.filter(s => s.id !== id) })
      }
      return null
    })
  }, [])

  const undo = useCallback(() => {
    const prev = pastRef.current.pop()
    if (!prev) return
    setShapes(curr => { futureRef.current.push(JSON.parse(JSON.stringify(curr))); return prev })
    setSelectedId(null)
  }, [])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (!next) return
    setShapes(curr => { pastRef.current.push(JSON.parse(JSON.stringify(curr))); return next })
    setSelectedId(null)
  }, [])

  const clearAll = useCallback(() => {
    setShapes(prev => { snapshot(prev); return [] })
    setSelectedId(null)
  }, [])

  const patchStyle = useCallback((patch: Partial<Style>) => {
    setStyle(s => ({ ...s, ...patch }))
  }, [])

  return {
    shapes, selectedId, tool, style,
    setSelectedId, setTool, patchStyle,
    addShape, updateShape, moveShape, deleteShape, deleteSelected,
    undo, redo, clearAll,
    get canUndo() { return pastRef.current.length > 0 },
    get canRedo() { return futureRef.current.length > 0 },
  }
}
