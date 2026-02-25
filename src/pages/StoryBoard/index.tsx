import { useState, useRef, useMemo, useEffect } from 'react'
import { useBoard } from './useBoard'
import BoardColumn from './BoardColumn'
import { COLUMN_COLORS, KanbanBoard, KanbanCard, Priority, PRIORITY_META, tagPalette } from './types'

interface DragState {
  cardId: string
  fromColId: string
}

interface ColDragState {
  colId: string
}

export default function StoryBoard() {
  const {
    boards, activeBoardId, activeBoard,
    addBoard, deleteBoard, renameBoard, setActiveBoard,
    addColumn, renameColumn, recolorColumn, deleteColumn, reorderColumn,
    setWipLimit,
    addCard, updateCard, deleteCard, moveCard,
    archiveCard, restoreCard, getArchivedCards, importBoard,
  } = useBoard()

  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropTarget, setDropTarget] = useState<{ colId: string; beforeCardId: string | null } | null>(null)

  // Column drag state
  const [colDragState, setColDragState] = useState<ColDragState | null>(null)
  const [colDropTarget, setColDropTarget] = useState<{ beforeColId: string | null } | null>(null)

  // New board
  const [newBoardName, setNewBoardName] = useState('')
  const [showNewBoard, setShowNewBoard] = useState(false)

  // Board rename
  const [renamingBoard, setRenamingBoard] = useState(false)
  const [boardNameDraft, setBoardNameDraft] = useState('')

  // Add column
  const [showAddCol, setShowAddCol] = useState(false)
  const [newColTitle, setNewColTitle] = useState('')
  const [newColColor, setNewColColor] = useState(COLUMN_COLORS[1].value)

  // Board switcher dropdown
  const [boardDropdown, setBoardDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ── Filter state ─────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // ── Archive state ────────────────────────────────
  const [showArchive, setShowArchive] = useState(false)
  const [restoreColId, setRestoreColId] = useState<Record<string, string>>({})

  // ── Keyboard focus state ───────────────────────
  const [focusedColIndex, setFocusedColIndex] = useState<number>(0)
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  // Triggers for opening add/edit modals in BoardColumn from keyboard
  const [kbAddCardColId, setKbAddCardColId] = useState<string | null>(null)
  const [kbEditCardId, setKbEditCardId] = useState<string | null>(null)

  // Import ref
  const importInputRef = useRef<HTMLInputElement>(null)

  // All unique tags across the active board
  const allTags = useMemo(() => {
    if (!activeBoard) return [] as string[]
    const tags = new Set<string>()
    Object.values(activeBoard.cards).forEach(c => (c.tags ?? []).forEach(t => tags.add(t)))
    return Array.from(tags).sort()
  }, [activeBoard])

  const filtersActive = searchTerm.trim() !== '' || priorityFilter !== 'all' || tagFilter !== ''

  // Compute filtered card IDs
  const filteredCardIds = useMemo<Set<string> | null>(() => {
    if (!filtersActive || !activeBoard) return null
    const term = searchTerm.trim().toLowerCase()
    const ids = new Set<string>()
    Object.values(activeBoard.cards).forEach(card => {
      if (card.archived ?? false) return
      // search filter
      if (term) {
        const inTitle = card.title.toLowerCase().includes(term)
        const inDesc = card.description.toLowerCase().includes(term)
        if (!inTitle && !inDesc) return
      }
      // priority filter
      if (priorityFilter !== 'all' && card.priority !== priorityFilter) return
      // tag filter
      if (tagFilter && !(card.tags ?? []).includes(tagFilter)) return
      ids.add(card.id)
    })
    return ids
  }, [activeBoard, searchTerm, priorityFilter, tagFilter, filtersActive])

  // Archived cards
  const archivedCards = useMemo(() => {
    if (!activeBoard) return []
    return getArchivedCards(activeBoard.id)
  }, [activeBoard, getArchivedCards])

  const clearFilters = () => {
    setSearchTerm('')
    setPriorityFilter('all')
    setTagFilter('')
  }

  // ── Visible cards per column (respects filters) ────
  const visibleCardsPerColumn = useMemo(() => {
    if (!activeBoard) return [] as { colId: string; cardIds: string[] }[]
    return activeBoard.columns.map(col => {
      const ids = col.cardIds.filter(id => {
        const card = activeBoard.cards[id]
        if (!card || (card.archived ?? false)) return false
        if (filteredCardIds && !filteredCardIds.has(id)) return false
        return true
      })
      return { colId: col.id, cardIds: ids }
    })
  }, [activeBoard, filteredCardIds])

  // ── Keyboard navigation ────────────────────────────
  useEffect(() => {
    if (!activeBoard) return

    const handler = (e: KeyboardEvent) => {
      // Don't handle if an input/textarea/select is focused
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      // Don't handle if activeElement is contentEditable
      if ((document.activeElement as HTMLElement)?.isContentEditable) return

      const cols = visibleCardsPerColumn
      if (cols.length === 0) return

      const clampedColIdx = Math.min(focusedColIndex, cols.length - 1)

      switch (e.key) {
        case '?': {
          e.preventDefault()
          setShowShortcutsHelp(v => !v)
          break
        }

        case 'Escape': {
          e.preventDefault()
          if (showShortcutsHelp) { setShowShortcutsHelp(false); break }
          if (showArchive) { setShowArchive(false); break }
          if (showFilters) { setShowFilters(false); break }
          // Clear focus
          setFocusedCardId(null)
          break
        }

        case 'a': {
          e.preventDefault()
          setShowArchive(v => !v)
          break
        }

        case 'f': {
          e.preventDefault()
          setShowFilters(v => !v)
          break
        }

        case 'j':
        case 'ArrowDown': {
          e.preventDefault()
          const col = cols[clampedColIdx]
          if (!col || col.cardIds.length === 0) break
          if (!focusedCardId) {
            // Focus first card in current column
            setFocusedColIndex(clampedColIdx)
            setFocusedCardId(col.cardIds[0])
          } else {
            const idx = col.cardIds.indexOf(focusedCardId)
            if (idx === -1) {
              // Card not in this column, focus first
              setFocusedCardId(col.cardIds[0])
            } else if (idx < col.cardIds.length - 1) {
              setFocusedCardId(col.cardIds[idx + 1])
            }
            // else already at last card, stay
          }
          break
        }

        case 'k':
        case 'ArrowUp': {
          e.preventDefault()
          const col = cols[clampedColIdx]
          if (!col || col.cardIds.length === 0) break
          if (!focusedCardId) {
            // Focus last card in current column
            setFocusedColIndex(clampedColIdx)
            setFocusedCardId(col.cardIds[col.cardIds.length - 1])
          } else {
            const idx = col.cardIds.indexOf(focusedCardId)
            if (idx === -1) {
              setFocusedCardId(col.cardIds[col.cardIds.length - 1])
            } else if (idx > 0) {
              setFocusedCardId(col.cardIds[idx - 1])
            }
            // else already at first card, stay
          }
          break
        }

        case 'h':
        case 'ArrowLeft': {
          e.preventDefault()
          if (clampedColIdx > 0) {
            const newColIdx = clampedColIdx - 1
            setFocusedColIndex(newColIdx)
            const newCol = cols[newColIdx]
            if (newCol.cardIds.length === 0) {
              setFocusedCardId(null)
            } else {
              // Keep relative position
              const oldCol = cols[clampedColIdx]
              const oldIdx = focusedCardId ? oldCol.cardIds.indexOf(focusedCardId) : 0
              const relIdx = Math.min(Math.max(oldIdx, 0), newCol.cardIds.length - 1)
              setFocusedCardId(newCol.cardIds[relIdx])
            }
          }
          break
        }

        case 'l':
        case 'ArrowRight': {
          e.preventDefault()
          if (clampedColIdx < cols.length - 1) {
            const newColIdx = clampedColIdx + 1
            setFocusedColIndex(newColIdx)
            const newCol = cols[newColIdx]
            if (newCol.cardIds.length === 0) {
              setFocusedCardId(null)
            } else {
              const oldCol = cols[clampedColIdx]
              const oldIdx = focusedCardId ? oldCol.cardIds.indexOf(focusedCardId) : 0
              const relIdx = Math.min(Math.max(oldIdx, 0), newCol.cardIds.length - 1)
              setFocusedCardId(newCol.cardIds[relIdx])
            }
          }
          break
        }

        case 'Enter': {
          if (focusedCardId) {
            e.preventDefault()
            setKbEditCardId(focusedCardId)
          }
          break
        }

        case 'n': {
          e.preventDefault()
          const col = cols[clampedColIdx]
          if (col) {
            setKbAddCardColId(col.colId)
          }
          break
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [activeBoard, visibleCardsPerColumn, focusedColIndex, focusedCardId, showShortcutsHelp, showArchive, showFilters])

  // ── Card drag handlers ────────────────────────────
  const handleDrop = () => {
    if (!dragState || !dropTarget || !activeBoard) return
    moveCard(activeBoard.id, dragState.cardId, dragState.fromColId, dropTarget.colId, dropTarget.beforeCardId)
    setDragState(null)
    setDropTarget(null)
  }

  const handleDragEnd = () => {
    setDragState(null)
    setDropTarget(null)
    setColDragState(null)
    setColDropTarget(null)
  }

  // ── Column drag handlers ──────────────────────────
  const handleColDrop = () => {
    if (!colDragState || !colDropTarget || !activeBoard) return
    reorderColumn(activeBoard.id, colDragState.colId, colDropTarget.beforeColId)
    setColDragState(null)
    setColDropTarget(null)
  }

  // ── Board actions ────────────────────────────────
  const handleAddBoard = () => {
    const name = newBoardName.trim()
    if (!name) return
    addBoard(name)
    setNewBoardName('')
    setShowNewBoard(false)
  }

  const handleAddColumn = () => {
    if (!activeBoard || !newColTitle.trim()) return
    addColumn(activeBoard.id, newColTitle.trim(), newColColor)
    setNewColTitle('')
    setNewColColor(COLUMN_COLORS[1].value)
    setShowAddCol(false)
  }

  // ── Export / Import ──────────────────────────────
  const handleExport = () => {
    if (!activeBoard) return
    const json = JSON.stringify(activeBoard, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeBoard.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as KanbanBoard
        // Validate required fields
        if (!data.name || !Array.isArray(data.columns) || typeof data.cards !== 'object') {
          alert('Invalid board file: missing name, columns, or cards.')
          return
        }
        // Ensure createdAt exists
        if (!data.createdAt) data.createdAt = new Date().toISOString()
        importBoard(data)
      } catch {
        alert('Invalid JSON file.')
      }
    }
    reader.readAsText(file)
    // Reset so same file can be imported again
    e.target.value = ''
  }

  // ── Archive handlers ─────────────────────────────
  const handleRestore = (cardId: string) => {
    if (!activeBoard) return
    const targetCol = restoreColId[cardId] || activeBoard.columns[0]?.id
    if (!targetCol) return
    restoreCard(activeBoard.id, cardId, targetCol)
    setRestoreColId(prev => { const n = { ...prev }; delete n[cardId]; return n })
  }

  const handlePermanentDelete = (card: KanbanCard) => {
    if (!activeBoard) return
    // Find which column has the card (should be none since archived), or just remove from cards
    // archiveCard already removed from column, so we just need to delete the card record
    // Use updateCard won't work here - we need a direct delete. Since archiveCard already
    // removed from columns, we can use deleteCard with an empty colId trick, but let's
    // find any column or use a dummy approach. Actually, the card is not in any column's cardIds
    // so we just need to remove it from the cards map.
    // We'll call deleteCard with the first column id - it won't find it in cardIds but will remove from cards map.
    deleteCard(activeBoard.id, activeBoard.columns[0]?.id ?? '', card.id)
  }

  if (!activeBoard) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-fg3">
        <p className="text-sm">No boards yet.</p>
        <button
          onClick={() => { addBoard('My Board') }}
          className="px-4 py-2 bg-acc text-accon rounded-lg text-sm font-medium hover:opacity-90"
        >
          Create Board
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      onDragEnd={handleDragEnd}
    >
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-line bg-surface">
        {/* Board selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setBoardDropdown(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-raised hover:bg-line/30 transition-colors text-sm font-semibold text-fg1 max-w-[200px]"
          >
            <span className="truncate">{activeBoard.name}</span>
            <svg className="w-3.5 h-3.5 text-fg3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {boardDropdown && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-surface border border-line rounded-xl shadow-lg py-1 min-w-48">
              {boards.map(b => (
                <div key={b.id} className="flex items-center group">
                  <button
                    onClick={() => { setActiveBoard(b.id); setBoardDropdown(false) }}
                    className={`flex-1 text-left px-4 py-2 text-sm truncate transition-colors ${
                      b.id === activeBoardId ? 'text-acc font-semibold' : 'text-fg1 hover:bg-raised'
                    }`}
                  >
                    {b.id === activeBoardId && <span className="mr-1.5">&#10003;</span>}
                    {b.name}
                  </button>
                  {boards.length > 1 && (
                    <button
                      onClick={() => deleteBoard(b.id)}
                      className="w-8 h-8 flex items-center justify-center text-fg3 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <div className="border-t border-line mt-1 pt-1">
                {showNewBoard ? (
                  <div className="flex items-center gap-1 px-2 py-1">
                    <input
                      autoFocus
                      className="flex-1 min-w-0 px-2 py-1 text-sm rounded border border-line2 bg-raised text-fg1 outline-none focus:border-acc"
                      placeholder="Board name"
                      value={newBoardName}
                      onChange={e => setNewBoardName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddBoard(); if (e.key === 'Escape') setShowNewBoard(false) }}
                    />
                    <button onClick={handleAddBoard} className="px-2 py-1 text-xs bg-acc text-accon rounded font-medium">Add</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewBoard(true)}
                    className="w-full text-left px-4 py-2 text-sm text-fg3 hover:text-acc hover:bg-raised transition-colors flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Board
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Board rename */}
        {renamingBoard ? (
          <input
            autoFocus
            className="text-sm font-semibold px-2 py-1 border border-acc rounded-lg bg-raised text-fg1 outline-none w-40"
            value={boardNameDraft}
            onChange={e => setBoardNameDraft(e.target.value)}
            onBlur={() => { renameBoard(activeBoard.id, boardNameDraft.trim() || activeBoard.name); setRenamingBoard(false) }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { renameBoard(activeBoard.id, boardNameDraft.trim() || activeBoard.name); setRenamingBoard(false) } }}
          />
        ) : (
          <button
            onClick={() => { setBoardNameDraft(activeBoard.name); setRenamingBoard(true) }}
            className="text-fg3 hover:text-acc transition-colors"
            title="Rename board"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16 3l5 5-9 9H7v-5L16 3z" />
            </svg>
          </button>
        )}

        {/* Stats */}
        <span className="text-xs text-fg3 ml-1">
          {activeBoard.columns.reduce((s, c) => s + c.cardIds.length, 0)} cards · {activeBoard.columns.length} columns
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Keyboard shortcuts hint */}
          <button
            onClick={() => setShowShortcutsHelp(v => !v)}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold text-fg3 hover:text-fg1 hover:bg-raised border border-transparent hover:border-line2 transition-colors"
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>

          {/* Export board */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-fg3 hover:text-fg1 hover:bg-raised border border-transparent hover:border-line2 transition-colors"
            title="Export board as JSON"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>

          {/* Import board */}
          <button
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-fg3 hover:text-fg1 hover:bg-raised border border-transparent hover:border-line2 transition-colors"
            title="Import board from JSON"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />

          {/* Archive toggle */}
          <button
            onClick={() => setShowArchive(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              showArchive
                ? 'bg-acc/15 text-acc border border-acc/30'
                : 'text-fg3 hover:text-fg1 hover:bg-raised border border-transparent hover:border-line2'
            }`}
            title="Show archived cards"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            Archive
            {archivedCards.length > 0 && (
              <span className="bg-fg3/20 text-fg3 text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {archivedCards.length}
              </span>
            )}
          </button>

          {/* Add column */}
          {showAddCol ? (
            <div className="flex items-center gap-1.5 bg-raised border border-line rounded-lg px-2 py-1">
              <input
                autoFocus
                className="w-28 text-sm bg-transparent text-fg1 outline-none placeholder:text-fg3"
                placeholder="Column name"
                value={newColTitle}
                onChange={e => setNewColTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddColumn(); if (e.key === 'Escape') setShowAddCol(false) }}
              />
              <div className="flex gap-1">
                {COLUMN_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setNewColColor(c.value)}
                    className="w-4 h-4 rounded-full transition-transform hover:scale-125"
                    style={{ background: c.value, outline: newColColor === c.value ? `2px solid ${c.value}` : 'none', outlineOffset: 1 }}
                  />
                ))}
              </div>
              <button onClick={handleAddColumn} className="px-2 py-0.5 text-xs bg-acc text-accon rounded font-medium">Add</button>
              <button onClick={() => setShowAddCol(false)} className="text-fg3 hover:text-fg1 text-xs">&#10005;</button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddCol(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-dashed border-line2 text-fg3 hover:text-acc hover:border-acc transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Column
            </button>
          )}
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────── */}
      <div className="shrink-0 px-4 border-b border-line bg-surface">
        <div className="flex items-center gap-2 py-2">
          {/* Toggle filter visibility */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filtersActive
                ? 'bg-acc/15 text-acc border border-acc/30'
                : 'text-fg3 hover:text-fg1 hover:bg-raised border border-transparent'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter
            {filtersActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-acc" />
            )}
          </button>

          {showFilters && (
            <>
              {/* Search input */}
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  className="w-48 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-line2 bg-raised text-fg1 placeholder-fg3 focus:outline-none focus:ring-2 focus:ring-acc focus:border-acc"
                  placeholder="Search cards..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Priority filter */}
              <div className="flex items-center gap-1">
                {(['all', 'low', 'medium', 'high', 'urgent'] as const).map(p => {
                  const isAll = p === 'all'
                  const active = priorityFilter === p
                  const meta = isAll ? null : PRIORITY_META[p]
                  return (
                    <button
                      key={p}
                      onClick={() => setPriorityFilter(p)}
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border transition-all"
                      style={{
                        borderColor: active ? (meta?.color ?? 'var(--acc)') : 'var(--line2)',
                        background: active ? ((meta?.color ?? 'var(--acc)') + '20') : 'transparent',
                        color: active ? (meta?.color ?? 'var(--acc)') : 'var(--fg3)',
                      }}
                    >
                      {!isAll && <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta!.color }} />}
                      {isAll ? 'All' : meta!.label}
                    </button>
                  )
                })}
              </div>

              {/* Tag filter */}
              {allTags.length > 0 && (
                <select
                  className="text-xs rounded-lg border border-line2 bg-raised text-fg1 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-acc focus:border-acc cursor-pointer"
                  value={tagFilter}
                  onChange={e => setTagFilter(e.target.value)}
                >
                  <option value="">All tags</option>
                  {allTags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              )}

              {/* Clear filters */}
              {filtersActive && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-fg3 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Archive panel ────────────────────────────────────── */}
      {showArchive && (
        <div className="shrink-0 border-b border-line bg-surface px-4 py-3 max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-fg1">Archived Cards ({archivedCards.length})</h3>
            <button
              onClick={() => setShowArchive(false)}
              className="w-5 h-5 flex items-center justify-center rounded text-fg3 hover:text-fg1 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {archivedCards.length === 0 ? (
            <p className="text-xs text-fg3 italic py-2">No archived cards.</p>
          ) : (
            <div className="space-y-2">
              {archivedCards.map(card => {
                const priority = PRIORITY_META[card.priority]
                return (
                  <div key={card.id} className="flex items-center gap-3 rounded-lg border border-line2 bg-raised/60 px-3 py-2">
                    {/* Card info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {card.priority !== 'none' && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: priority.color }} />
                        )}
                        <p className="text-sm font-medium text-fg1 truncate">{card.title}</p>
                      </div>
                      {card.description && (
                        <p className="text-xs text-fg3 truncate mt-0.5">{card.description}</p>
                      )}
                      {card.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {card.tags.map(tag => {
                            const p = tagPalette(tag)
                            return (
                              <span key={tag} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                                style={{ background: p.bg, color: p.fg }}>
                                {tag}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Restore: column picker + button */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        className="text-xs rounded border border-line2 bg-surface text-fg1 px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-acc cursor-pointer"
                        value={restoreColId[card.id] || activeBoard.columns[0]?.id || ''}
                        onChange={e => setRestoreColId(prev => ({ ...prev, [card.id]: e.target.value }))}
                      >
                        {activeBoard.columns.map(col => (
                          <option key={col.id} value={col.id}>{col.title}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleRestore(card.id)}
                        className="px-2 py-1 text-xs font-medium rounded bg-acc text-accon hover:opacity-90 transition-opacity"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(card)}
                        className="px-2 py-1 text-xs font-medium rounded text-red-500 hover:bg-red-500/10 border border-red-500/30 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Keyboard shortcuts help overlay ─────────────────── */}
      {showShortcutsHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowShortcutsHelp(false)}
        >
          <div
            className="bg-surface border border-line rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-fg1">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-fg3 hover:text-fg1 hover:bg-raised transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {([
                ['j / \u2193', 'Move focus to next card'],
                ['k / \u2191', 'Move focus to previous card'],
                ['h / \u2190', 'Move focus to previous column'],
                ['l / \u2192', 'Move focus to next column'],
                ['Enter', 'Open focused card for editing'],
                ['n', 'Add new card to focused column'],
                ['Escape', 'Close modal / clear focus'],
                ['?', 'Toggle this help overlay'],
                ['a', 'Toggle archive panel'],
                ['f', 'Toggle filter bar'],
              ] as [string, string][]).map(([key, desc]) => (
                <div key={key} className="contents">
                  <div className="flex items-center gap-2 py-1">
                    <kbd className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md bg-raised border border-line2 text-xs font-mono font-semibold text-fg1">
                      {key}
                    </kbd>
                  </div>
                  <div className="flex items-center py-1">
                    <span className="text-sm text-fg2">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-fg3 mt-4 pt-3 border-t border-line">
              Shortcuts are disabled when typing in inputs or textareas.
            </p>
          </div>
        </div>
      )}

      {/* ── Board canvas ─────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div className="flex gap-4 h-full items-start">
          {activeBoard.columns.map((col, colIdx) => {
            const cards = col.cardIds.map(id => activeBoard.cards[id]).filter(Boolean)
            return (
              <BoardColumn
                key={col.id}
                column={col}
                cards={cards}
                boardId={activeBoard.id}
                dragState={dragState}
                dropTarget={dropTarget}
                onDragStart={(cardId, colId) => setDragState({ cardId, fromColId: colId })}
                onDragEnterCard={(colId, beforeCardId) => setDropTarget({ colId, beforeCardId })}
                onDragEnterEnd={colId => setDropTarget({ colId, beforeCardId: null })}
                onDrop={handleDrop}
                onAddCard={(colId, data) => addCard(activeBoard.id, colId, data)}
                onEditCard={(cardId, data) => updateCard(activeBoard.id, cardId, data)}
                onDeleteCard={(colId, cardId) => deleteCard(activeBoard.id, colId, cardId)}
                onRename={(colId, title) => renameColumn(activeBoard.id, colId, title)}
                onRecolor={(colId, color) => recolorColumn(activeBoard.id, colId, color)}
                onDelete={colId => deleteColumn(activeBoard.id, colId)}
                filteredCardIds={filteredCardIds}
                // Column drag
                colDragState={colDragState}
                colDropTarget={colDropTarget}
                onColDragStart={colId => setColDragState({ colId })}
                onColDragEnter={beforeColId => setColDropTarget({ beforeColId })}
                onColDrop={handleColDrop}
                // WIP
                onSetWipLimit={(colId, limit) => setWipLimit(activeBoard.id, colId, limit)}
                // Archive
                onArchiveCard={(colId, cardId) => archiveCard(activeBoard.id, colId, cardId)}
                // Keyboard focus
                focusedCardId={colIdx === Math.min(focusedColIndex, activeBoard.columns.length - 1) ? focusedCardId : null}
                // External add/edit triggers from keyboard
                requestAddCard={kbAddCardColId === col.id}
                onRequestAddCardHandled={() => setKbAddCardColId(null)}
                requestEditCardId={kbEditCardId && cards.some(c => c.id === kbEditCardId) ? kbEditCardId : null}
                onRequestEditCardHandled={() => setKbEditCardId(null)}
              />
            )
          })}

          {/* End-of-board column drop zone */}
          {colDragState && (
            <div
              className="w-16 h-full shrink-0 flex items-center justify-center"
              onDragOver={e => { e.preventDefault(); setColDropTarget({ beforeColId: null }) }}
              onDrop={e => { e.preventDefault(); handleColDrop() }}
            >
              {colDropTarget?.beforeColId === null && (
                <div className="w-0.5 h-32 bg-acc rounded-full" />
              )}
            </div>
          )}

          {/* Empty state */}
          {activeBoard.columns.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-fg3 text-sm">
              No columns yet. Add one using the button above.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
