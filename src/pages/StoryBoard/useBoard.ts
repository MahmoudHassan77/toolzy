import { useState, useCallback, useEffect, useRef } from 'react'
import { KanbanBoard, KanbanCard, KanbanColumn, Subtask } from './types'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../services/api'

const STORAGE_KEY = 'toolzy_kanban'

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function makeBoard(name: string): KanbanBoard {
  const cols: KanbanColumn[] = [
    { id: uid(), title: 'Backlog',     color: '#6b7280', cardIds: [] },
    { id: uid(), title: 'In Progress', color: '#3b82f6', cardIds: [] },
    { id: uid(), title: 'Review',      color: '#f97316', cardIds: [] },
    { id: uid(), title: 'Done',        color: '#22c55e', cardIds: [] },
  ]
  return { id: uid(), name, columns: cols, cards: {}, createdAt: new Date().toISOString() }
}

interface Store { boards: KanbanBoard[]; activeBoardId: string | null }

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Store
  } catch { /* ignore */ }
  const board = makeBoard('My Board')
  return { boards: [board], activeBoardId: board.id }
}

function persist(s: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function useBoard() {
  const [store, setStore] = useState<Store>(load)
  const { isAuthenticated } = useAuth()
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from server on mount when authenticated
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    api.getBoards().then((serverBoards: KanbanBoard[]) => {
      if (cancelled) return
      if (!Array.isArray(serverBoards) || serverBoards.length === 0) return
      setStore(prev => {
        // Merge: server boards override local by ID, keep local-only boards
        const serverMap = new Map(serverBoards.map(b => [b.id, b]))
        const merged: KanbanBoard[] = []
        const seenIds = new Set<string>()
        // Server boards take priority
        for (const b of serverBoards) {
          merged.push(b)
          seenIds.add(b.id)
        }
        // Keep local-only boards
        for (const b of prev.boards) {
          if (!seenIds.has(b.id)) merged.push(b)
        }
        const next: Store = { boards: merged, activeBoardId: prev.activeBoardId ?? merged[0]?.id ?? null }
        persist(next)
        return next
      })
    }).catch(() => { /* offline: use localStorage */ })
    return () => { cancelled = true }
  }, [isAuthenticated])

  // Debounced API sync on store changes
  useEffect(() => {
    if (!isAuthenticated) return
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      // Sync all boards to API
      for (const board of store.boards) {
        api.updateBoard(board.id, board).catch(() => {
          // If board doesn't exist on server yet, create it
          api.createBoard(board.name, board).catch(() => { /* offline */ })
        })
      }
    }, 1000)
    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current) }
  }, [store, isAuthenticated])

  const set = useCallback((fn: (prev: Store) => Store) => {
    setStore(prev => {
      const next = fn(prev)
      persist(next)
      return next
    })
  }, [])

  const patchBoard = useCallback((id: string, fn: (b: KanbanBoard) => KanbanBoard) => {
    set(s => ({ ...s, boards: s.boards.map(b => b.id === id ? fn(b) : b) }))
  }, [set])

  const activeBoard = store.boards.find(b => b.id === store.activeBoardId) ?? store.boards[0] ?? null

  // ── Board ──────────────────────────────────────────────────
  const addBoard = useCallback((name: string) => {
    const board = makeBoard(name)
    set(s => ({ boards: [...s.boards, board], activeBoardId: board.id }))
    if (isAuthenticated) {
      api.createBoard(board.name, board).catch(() => {})
    }
  }, [set, isAuthenticated])

  const deleteBoard = useCallback((id: string) => {
    set(s => {
      const boards = s.boards.filter(b => b.id !== id)
      const activeBoardId = s.activeBoardId === id ? (boards[0]?.id ?? null) : s.activeBoardId
      return { boards, activeBoardId }
    })
    if (isAuthenticated) {
      api.deleteBoard(id).catch(() => {})
    }
  }, [set, isAuthenticated])

  const renameBoard = useCallback((id: string, name: string) => {
    patchBoard(id, b => ({ ...b, name }))
  }, [patchBoard])

  const setActiveBoard = useCallback((id: string) => {
    set(s => ({ ...s, activeBoardId: id }))
  }, [set])

  // ── Column ─────────────────────────────────────────────────
  const addColumn = useCallback((boardId: string, title: string, color: string) => {
    const col: KanbanColumn = { id: uid(), title, color, cardIds: [] }
    patchBoard(boardId, b => ({ ...b, columns: [...b.columns, col] }))
  }, [patchBoard])

  const renameColumn = useCallback((boardId: string, colId: string, title: string) => {
    patchBoard(boardId, b => ({
      ...b,
      columns: b.columns.map(c => c.id === colId ? { ...c, title } : c),
    }))
  }, [patchBoard])

  const recolorColumn = useCallback((boardId: string, colId: string, color: string) => {
    patchBoard(boardId, b => ({
      ...b,
      columns: b.columns.map(c => c.id === colId ? { ...c, color } : c),
    }))
  }, [patchBoard])

  const deleteColumn = useCallback((boardId: string, colId: string) => {
    patchBoard(boardId, b => {
      const col = b.columns.find(c => c.id === colId)
      if (!col) return b
      const cards = { ...b.cards }
      col.cardIds.forEach(id => delete cards[id])
      return { ...b, columns: b.columns.filter(c => c.id !== colId), cards }
    })
  }, [patchBoard])

  // ── Card ───────────────────────────────────────────────────
  const addCard = useCallback((boardId: string, colId: string, data: Omit<KanbanCard, 'id' | 'createdAt'>) => {
    const card: KanbanCard = { ...data, subtasks: data.subtasks ?? [], id: uid(), createdAt: new Date().toISOString() }
    patchBoard(boardId, b => ({
      ...b,
      columns: b.columns.map(c => c.id === colId ? { ...c, cardIds: [...c.cardIds, card.id] } : c),
      cards: { ...b.cards, [card.id]: card },
    }))
  }, [patchBoard])

  const updateCard = useCallback((boardId: string, cardId: string, data: Partial<Omit<KanbanCard, 'id' | 'createdAt'>>) => {
    patchBoard(boardId, b => ({
      ...b,
      cards: { ...b.cards, [cardId]: { ...b.cards[cardId], ...data } },
    }))
  }, [patchBoard])

  const deleteCard = useCallback((boardId: string, colId: string, cardId: string) => {
    patchBoard(boardId, b => {
      const cards = { ...b.cards }
      delete cards[cardId]
      return {
        ...b,
        columns: b.columns.map(c => c.id === colId
          ? { ...c, cardIds: c.cardIds.filter(id => id !== cardId) }
          : c),
        cards,
      }
    })
  }, [patchBoard])

  const moveCard = useCallback((
    boardId: string,
    cardId: string,
    fromColId: string,
    toColId: string,
    beforeCardId: string | null, // null = end
  ) => {
    patchBoard(boardId, b => {
      // Remove from source
      const srcIds = b.columns.find(c => c.id === fromColId)!.cardIds.filter(id => id !== cardId)
      // Build target list (may be same column)
      let dstIds = fromColId === toColId
        ? srcIds
        : b.columns.find(c => c.id === toColId)!.cardIds.filter(id => id !== cardId)
      const insertAt = beforeCardId != null ? dstIds.indexOf(beforeCardId) : dstIds.length
      dstIds = [...dstIds.slice(0, insertAt), cardId, ...dstIds.slice(insertAt)]

      return {
        ...b,
        columns: b.columns.map(c => {
          if (fromColId === toColId && c.id === fromColId) return { ...c, cardIds: dstIds }
          if (c.id === fromColId) return { ...c, cardIds: srcIds }
          if (c.id === toColId)   return { ...c, cardIds: dstIds }
          return c
        }),
      }
    })
  }, [patchBoard])

  // ── Column reorder ────────────────────────────────────────
  const reorderColumn = useCallback((boardId: string, colId: string, beforeColId: string | null) => {
    patchBoard(boardId, b => {
      const cols = b.columns.filter(c => c.id !== colId)
      const col = b.columns.find(c => c.id === colId)
      if (!col) return b
      const insertAt = beforeColId != null ? cols.findIndex(c => c.id === beforeColId) : cols.length
      const idx = insertAt === -1 ? cols.length : insertAt
      return { ...b, columns: [...cols.slice(0, idx), col, ...cols.slice(idx)] }
    })
  }, [patchBoard])

  // ── WIP Limits ──────────────────────────────────────────
  const setWipLimit = useCallback((boardId: string, colId: string, limit: number | undefined) => {
    patchBoard(boardId, b => ({
      ...b,
      columns: b.columns.map(c => c.id === colId ? { ...c, wipLimit: limit } : c),
    }))
  }, [patchBoard])

  // ── Archive ─────────────────────────────────────────────
  const archiveCard = useCallback((boardId: string, colId: string, cardId: string) => {
    patchBoard(boardId, b => ({
      ...b,
      columns: b.columns.map(c => c.id === colId
        ? { ...c, cardIds: c.cardIds.filter(id => id !== cardId) }
        : c),
      cards: { ...b.cards, [cardId]: { ...b.cards[cardId], archived: true } },
    }))
  }, [patchBoard])

  const restoreCard = useCallback((boardId: string, cardId: string, targetColId: string) => {
    patchBoard(boardId, b => ({
      ...b,
      columns: b.columns.map(c => c.id === targetColId
        ? { ...c, cardIds: [...c.cardIds, cardId] }
        : c),
      cards: { ...b.cards, [cardId]: { ...b.cards[cardId], archived: false } },
    }))
  }, [patchBoard])

  const getArchivedCards = useCallback((boardId: string): KanbanCard[] => {
    const board = store.boards.find(b => b.id === boardId)
    if (!board) return []
    return Object.values(board.cards).filter(c => c.archived ?? false)
  }, [store.boards])

  // ── Import board ────────────────────────────────────────
  const importBoard = useCallback((board: KanbanBoard) => {
    // Assign a new id to avoid collisions
    const imported: KanbanBoard = { ...board, id: uid() }
    set(s => ({ boards: [...s.boards, imported], activeBoardId: imported.id }))
  }, [set])

  // ── Subtasks ─────────────────────────────────────────────
  const patchCardSubtasks = useCallback((boardId: string, cardId: string, fn: (subs: Subtask[]) => Subtask[]) => {
    patchBoard(boardId, b => {
      const card = b.cards[cardId]
      if (!card) return b
      return { ...b, cards: { ...b.cards, [cardId]: { ...card, subtasks: fn(card.subtasks ?? []) } } }
    })
  }, [patchBoard])

  const addSubtask = useCallback((boardId: string, cardId: string, text: string) => {
    const sub: Subtask = { id: uid(), text, done: false }
    patchCardSubtasks(boardId, cardId, subs => [...subs, sub])
  }, [patchCardSubtasks])

  const toggleSubtask = useCallback((boardId: string, cardId: string, subtaskId: string) => {
    patchCardSubtasks(boardId, cardId, subs =>
      subs.map(s => s.id === subtaskId ? { ...s, done: !s.done } : s)
    )
  }, [patchCardSubtasks])

  const removeSubtask = useCallback((boardId: string, cardId: string, subtaskId: string) => {
    patchCardSubtasks(boardId, cardId, subs => subs.filter(s => s.id !== subtaskId))
  }, [patchCardSubtasks])

  const updateSubtask = useCallback((boardId: string, cardId: string, subtaskId: string, text: string) => {
    patchCardSubtasks(boardId, cardId, subs =>
      subs.map(s => s.id === subtaskId ? { ...s, text } : s)
    )
  }, [patchCardSubtasks])

  return {
    boards: store.boards,
    activeBoardId: store.activeBoardId,
    activeBoard,
    addBoard, deleteBoard, renameBoard, setActiveBoard,
    addColumn, renameColumn, recolorColumn, deleteColumn, reorderColumn,
    setWipLimit,
    addCard, updateCard, deleteCard, moveCard,
    archiveCard, restoreCard, getArchivedCards, importBoard,
    addSubtask, toggleSubtask, removeSubtask, updateSubtask,
  }
}
