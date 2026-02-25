import { useState, useEffect, useRef } from 'react'
import { KanbanCard as IKanbanCard, PRIORITY_META, tagPalette } from './types'

interface Props {
  card: IKanbanCard
  isDragging: boolean
  isDropTarget: boolean
  isFocused?: boolean
  onDragStart: () => void
  onDragEnter: () => void
  onEdit: () => void
  onDelete: () => void
  onArchive?: () => void
}

function isOverdue(dueDate: string): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date(new Date().toDateString())
}

export default function KanbanCard({ card, isDragging, isDropTarget, isFocused, onDragStart, onDragEnter, onEdit, onDelete, onArchive }: Props) {
  const [hovered, setHovered] = useState(false)
  const priority = PRIORITY_META[card.priority]
  const overdue = isOverdue(card.dueDate)
  const cardRef = useRef<HTMLDivElement>(null)

  // Scroll into view when focused via keyboard
  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [isFocused])

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart() }}
      onDragEnter={e => { e.preventDefault(); e.stopPropagation(); onDragEnter() }}
      onDragOver={e => e.preventDefault()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative transition-all"
      style={{ opacity: isDragging ? 0.35 : 1 }}
    >
      {/* Drop-before indicator */}
      {isDropTarget && (
        <div className="h-0.5 bg-acc rounded-full mb-1.5 mx-1" />
      )}

      <div
        className={`rounded-lg border bg-surface shadow-sm group ${isFocused ? 'ring-2 ring-acc' : ''}`}
        style={{ borderColor: isFocused ? 'var(--acc)' : hovered ? 'var(--acc)' : 'var(--line2)', cursor: 'grab' }}
      >
        {/* Priority stripe */}
        {card.priority !== 'none' && (
          <div
            className="h-1 rounded-t-lg"
            style={{ background: priority.color }}
          />
        )}

        <div className="p-3">
          {/* Header: title + actions */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-fg1 leading-snug flex-1 min-w-0">
              {card.title}
            </p>
            {hovered && (
              <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-0.5">
                <button
                  onClick={e => { e.stopPropagation(); onEdit() }}
                  className="w-6 h-6 flex items-center justify-center rounded text-fg3 hover:text-acc hover:bg-raised transition-colors"
                  title="Edit"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16 3l5 5-9 9H7v-5L16 3z" />
                  </svg>
                </button>
                {onArchive && !(card.archived ?? false) && (
                  <button
                    onClick={e => { e.stopPropagation(); onArchive() }}
                    className="w-6 h-6 flex items-center justify-center rounded text-fg3 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                    title="Archive"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={e => { e.stopPropagation(); onDelete() }}
                  className="w-6 h-6 flex items-center justify-center rounded text-fg3 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Delete"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Description preview */}
          {card.description && (
            <p className="text-xs text-fg3 mt-1 leading-relaxed line-clamp-2">{card.description}</p>
          )}

          {/* Tags */}
          {card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
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

          {/* Subtask progress bar */}
          {(card.subtasks?.length ?? 0) > 0 && (() => {
            const total = card.subtasks.length
            const done = card.subtasks.filter(s => s.done).length
            const pct = (done / total) * 100
            const barColor = done === 0 ? '#6b7280' : done === total ? '#22c55e' : '#3b82f6'
            return (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-[3px] rounded-full bg-line2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>
                <span className="text-[10px] font-medium shrink-0" style={{ color: barColor }}>
                  {done}/{total}
                </span>
              </div>
            )
          })()}

          {/* Footer: priority + due date */}
          {(card.priority !== 'none' || card.dueDate) && (
            <div className="flex items-center justify-between mt-2 gap-2">
              {card.priority !== 'none' && (
                <span className="flex items-center gap-1 text-[10px] font-medium"
                  style={{ color: priority.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: priority.color }} />
                  {priority.label}
                </span>
              )}
              {card.dueDate && (
                <span className={`ml-auto text-[10px] font-medium flex items-center gap-1 ${overdue ? 'text-red-500' : 'text-fg3'}`}>
                  {overdue && <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
                  {new Date(card.dueDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
