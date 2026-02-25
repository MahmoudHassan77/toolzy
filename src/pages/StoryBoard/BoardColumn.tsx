import { useState, useEffect } from 'react'
import { KanbanCard, KanbanColumn, COLUMN_COLORS } from './types'
import KanbanCardComp from './KanbanCard'
import CardModal from './CardModal'

interface DragState {
  cardId: string
  fromColId: string
}

interface ColDragState {
  colId: string
}

interface Props {
  column: KanbanColumn
  cards: KanbanCard[]
  boardId: string
  dragState: DragState | null
  dropTarget: { colId: string; beforeCardId: string | null } | null
  onDragStart: (cardId: string, colId: string) => void
  onDragEnterCard: (colId: string, beforeCardId: string) => void
  onDragEnterEnd: (colId: string) => void
  onDrop: () => void
  onAddCard: (colId: string, data: Omit<KanbanCard, 'id' | 'createdAt'>) => void
  onEditCard: (cardId: string, data: Partial<Omit<KanbanCard, 'id' | 'createdAt'>>) => void
  onDeleteCard: (colId: string, cardId: string) => void
  onRename: (colId: string, title: string) => void
  onRecolor: (colId: string, color: string) => void
  onDelete: (colId: string) => void
  filteredCardIds?: Set<string> | null
  // Column drag
  colDragState?: ColDragState | null
  colDropTarget?: { beforeColId: string | null } | null
  onColDragStart?: (colId: string) => void
  onColDragEnter?: (beforeColId: string | null) => void
  onColDrop?: () => void
  // WIP
  onSetWipLimit?: (colId: string, limit: number | undefined) => void
  // Archive
  onArchiveCard?: (colId: string, cardId: string) => void
  // Keyboard focus
  focusedCardId?: string | null
  // External triggers for add/edit via keyboard
  requestAddCard?: boolean
  onRequestAddCardHandled?: () => void
  requestEditCardId?: string | null
  onRequestEditCardHandled?: () => void
}

export default function BoardColumn({
  column, cards, boardId, dragState, dropTarget,
  onDragStart, onDragEnterCard, onDragEnterEnd, onDrop,
  onAddCard, onEditCard, onDeleteCard, onRename, onRecolor, onDelete,
  filteredCardIds,
  colDragState, colDropTarget,
  onColDragStart, onColDragEnter, onColDrop,
  onSetWipLimit,
  onArchiveCard,
  focusedCardId,
  requestAddCard,
  onRequestAddCardHandled,
  requestEditCardId,
  onRequestEditCardHandled,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(column.title)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<KanbanCard | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showWipMenu, setShowWipMenu] = useState(false)
  const [wipDraft, setWipDraft] = useState(column.wipLimit?.toString() ?? '')

  // Open add-card modal when triggered externally via keyboard shortcut (n)
  useEffect(() => {
    if (requestAddCard) {
      setAddOpen(true)
      onRequestAddCardHandled?.()
    }
  }, [requestAddCard, onRequestAddCardHandled])

  // Open edit-card modal when triggered externally via keyboard shortcut (Enter)
  useEffect(() => {
    if (requestEditCardId) {
      const card = cards.find(c => c.id === requestEditCardId)
      if (card) setEditingCard(card)
      onRequestEditCardHandled?.()
    }
  }, [requestEditCardId, cards, onRequestEditCardHandled])

  const visibleCards = filteredCardIds ? cards.filter(c => filteredCardIds.has(c.id)) : cards

  const isDropOver = dropTarget?.colId === column.id
  const isEndDrop = isDropOver && dropTarget?.beforeCardId === null

  // WIP limit
  const wipLimit = column.wipLimit ?? Infinity
  const cardCount = cards.length
  const isAtWip = wipLimit !== Infinity && cardCount >= wipLimit
  const isOverWip = wipLimit !== Infinity && cardCount > wipLimit

  // Column drag
  const isColDragging = colDragState?.colId === column.id
  const isColDropTarget = colDropTarget?.beforeColId === column.id

  const commitTitle = () => {
    const t = titleDraft.trim()
    if (t && t !== column.title) onRename(column.id, t)
    else setTitleDraft(column.title)
    setEditingTitle(false)
  }

  const handleColDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/x-column', column.id)
    e.dataTransfer.effectAllowed = 'move'
    onColDragStart?.(column.id)
  }

  const handleColDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    // Only show column drop target if we're dragging a column
    if (colDragState && colDragState.colId !== column.id) {
      onColDragEnter?.(column.id)
    }
  }

  const handleColDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (colDragState) {
      onColDrop?.()
    }
  }

  const handleWipSave = () => {
    const v = parseInt(wipDraft, 10)
    if (wipDraft.trim() === '' || isNaN(v) || v <= 0) {
      onSetWipLimit?.(column.id, undefined)
    } else {
      onSetWipLimit?.(column.id, v)
    }
    setShowWipMenu(false)
  }

  return (
    <div className="flex items-stretch shrink-0">
      {/* Column drop indicator (vertical line before this column) */}
      {isColDropTarget && colDragState && (
        <div className="w-0.5 bg-acc rounded-full shrink-0 my-2 -mr-1.5 ml-0" />
      )}

      <div
        className="flex flex-col w-72 shrink-0 rounded-xl border bg-raised/60 transition-opacity"
        style={{
          borderColor: isDropOver ? column.color : 'var(--line)',
          opacity: isColDragging ? 0.4 : 1,
        }}
        onDragOver={e => {
          e.preventDefault()
          // Column-level drag: if a column is being dragged
          if (colDragState && colDragState.colId !== column.id) {
            onColDragEnter?.(column.id)
          }
        }}
        onDrop={e => {
          e.preventDefault()
          if (colDragState) {
            onColDrop?.()
          } else {
            onDrop()
          }
        }}
      >
        {/* Column header */}
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          {/* Column drag grip handle */}
          <div
            draggable
            onDragStart={handleColDragStart}
            className="cursor-grab active:cursor-grabbing shrink-0 text-fg3 hover:text-fg1 transition-colors"
            title="Drag to reorder column"
          >
            <svg className="w-3.5 h-4" viewBox="0 0 14 16" fill="currentColor">
              <circle cx="4" cy="3" r="1.5" />
              <circle cx="10" cy="3" r="1.5" />
              <circle cx="4" cy="8" r="1.5" />
              <circle cx="10" cy="8" r="1.5" />
              <circle cx="4" cy="13" r="1.5" />
              <circle cx="10" cy="13" r="1.5" />
            </svg>
          </div>

          {/* Color dot / picker trigger */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(v => !v)}
              className="w-3 h-3 rounded-full shrink-0 ring-2 ring-offset-2 ring-offset-raised/60 transition-all hover:scale-125"
              style={{ background: column.color }}
              title="Change color"
            />
            {showColorPicker && (
              <div className="absolute top-5 left-0 z-20 bg-surface border border-line rounded-lg p-2 shadow-lg flex gap-1.5 flex-wrap w-36">
                {COLUMN_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => { onRecolor(column.id, c.value); setShowColorPicker(false) }}
                    className="w-5 h-5 rounded-full hover:scale-125 transition-transform"
                    style={{ background: c.value, outline: column.color === c.value ? `2px solid ${c.value}` : 'none', outlineOffset: 2 }}
                    title={c.label}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          {editingTitle ? (
            <input
              autoFocus
              className="flex-1 min-w-0 text-sm font-semibold text-fg1 bg-transparent border-b border-acc outline-none"
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(column.title); setEditingTitle(false) } }}
            />
          ) : (
            <button
              className="flex-1 min-w-0 text-sm font-semibold text-fg1 text-left hover:text-acc transition-colors truncate"
              onDoubleClick={() => setEditingTitle(true)}
              title="Double-click to rename"
            >
              {column.title}
            </button>
          )}

          {/* WIP limit + count badge */}
          <div className="relative shrink-0">
            <button
              onClick={() => { setWipDraft(column.wipLimit?.toString() ?? ''); setShowWipMenu(v => !v) }}
              className={`text-xs font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 transition-colors ${
                isOverWip
                  ? 'bg-red-500/15 text-red-500'
                  : isAtWip
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-raised text-fg3'
              }`}
              title="Click to set WIP limit"
            >
              {isOverWip && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              )}
              {wipLimit !== Infinity
                ? `${filteredCardIds ? visibleCards.length + '/' : ''}${cardCount}/${wipLimit}`
                : filteredCardIds ? `${visibleCards.length}/${cards.length}` : cards.length
              }
            </button>

            {showWipMenu && (
              <div className="absolute top-full right-0 mt-1 z-20 bg-surface border border-line rounded-lg shadow-lg p-3 w-48">
                <label className="text-xs font-medium text-fg1 block mb-1.5">WIP Limit</label>
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    type="number"
                    min="1"
                    className="flex-1 min-w-0 px-2 py-1 text-sm rounded border border-line2 bg-raised text-fg1 outline-none focus:border-acc"
                    placeholder="No limit"
                    value={wipDraft}
                    onChange={e => setWipDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleWipSave(); if (e.key === 'Escape') setShowWipMenu(false) }}
                  />
                  <button onClick={handleWipSave} className="px-2 py-1 text-xs bg-acc text-accon rounded font-medium">Set</button>
                </div>
                {column.wipLimit != null && (
                  <button
                    onClick={() => { onSetWipLimit?.(column.id, undefined); setShowWipMenu(false) }}
                    className="mt-1.5 text-[10px] text-fg3 hover:text-red-500 transition-colors"
                  >
                    Remove limit
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Delete column */}
          {confirmDelete ? (
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onDelete(column.id)} className="text-[10px] text-red-500 font-medium hover:underline">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-fg3 hover:underline">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-5 h-5 flex items-center justify-center rounded text-fg3 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
              title="Delete column"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Colored top bar */}
        <div className="h-0.5 mx-3 rounded-full mb-2" style={{ background: column.color }} />

        {/* Cards */}
        <div
          className="flex-1 px-2 pb-2 space-y-1.5 overflow-y-auto max-h-[calc(100vh-240px)] min-h-[60px]"
          onDragEnter={() => {
            // Only handle card drag enter, not column drag
            if (dragState && !colDragState) onDragEnterEnd(column.id)
          }}
        >
          {visibleCards.map(card => (
            <KanbanCardComp
              key={card.id}
              card={card}
              isDragging={dragState?.cardId === card.id}
              isDropTarget={dropTarget?.colId === column.id && dropTarget?.beforeCardId === card.id}
              isFocused={focusedCardId === card.id}
              onDragStart={() => onDragStart(card.id, column.id)}
              onDragEnter={() => onDragEnterCard(column.id, card.id)}
              onEdit={() => setEditingCard(card)}
              onDelete={() => onDeleteCard(column.id, card.id)}
              onArchive={onArchiveCard ? () => onArchiveCard(column.id, card.id) : undefined}
            />
          ))}

          {/* End-of-column drop indicator */}
          {isEndDrop && dragState && dragState.fromColId !== column.id && (
            <div className="h-0.5 bg-acc rounded-full mx-1 mt-1" />
          )}

          {visibleCards.length === 0 && !isDropOver && (
            <p className="text-xs text-fg3 italic text-center py-4">
              {filteredCardIds && cards.length > 0 ? 'No matching cards' : 'No cards yet'}
            </p>
          )}
        </div>

        {/* Add card button */}
        <div className="px-2 pb-2">
          <button
            onClick={() => setAddOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-fg3 hover:text-fg1 hover:bg-raised border border-dashed border-line2 hover:border-acc transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add card
          </button>
        </div>

        {/* Add card modal */}
        {addOpen && (
          <CardModal
            key={`add-${column.id}`}
            open={addOpen}
            onClose={() => setAddOpen(false)}
            columnTitle={column.title}
            onSave={data => onAddCard(column.id, data)}
          />
        )}

        {/* Edit card modal */}
        {editingCard && (
          <CardModal
            key={`edit-${editingCard.id}`}
            open={!!editingCard}
            onClose={() => setEditingCard(null)}
            initial={editingCard}
            onSave={data => onEditCard(editingCard.id, data)}
          />
        )}
      </div>
    </div>
  )
}
