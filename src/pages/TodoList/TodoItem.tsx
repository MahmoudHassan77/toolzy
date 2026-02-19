import { useState } from 'react'
import type { Todo, Priority } from './useTodos'

const PRIORITY_BORDER: Record<Priority, string> = {
  high:   'border-l-red-500',
  medium: 'border-l-amber-400',
  low:    'border-l-sky-400',
}

const PRIORITY_BADGE: Record<Priority, string> = {
  high:   'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/25',
  medium: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/25',
  low:    'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/25',
}

const PRIORITY_DOT: Record<Priority, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-sky-400',
}

interface Props {
  todo: Todo
  onToggle: () => void
  onDelete: () => void
  onUpdate: (patch: Partial<Pick<Todo, 'text' | 'priority' | 'dueDate'>>) => void
}

export default function TodoItem({ todo, onToggle, onDelete, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(todo.text)

  function commitEdit() {
    setEditing(false)
    if (editText.trim()) onUpdate({ text: editText.trim() })
    else setEditText(todo.text)
  }

  const isOverdue = todo.dueDate && !todo.done && new Date(todo.dueDate + 'T00:00:00') < new Date()

  return (
    <div
      className={`group flex items-start gap-3 p-4 rounded-2xl border border-line border-l-4 bg-surface
        hover:shadow-md transition-all duration-200
        ${todo.done ? 'opacity-50' : ''}
        ${PRIORITY_BORDER[todo.priority]}`}
    >
      {/* Custom circular checkbox */}
      <button
        onClick={onToggle}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center
          transition-all duration-200
          ${todo.done
            ? 'bg-acc border-acc shadow-sm'
            : 'border-line2 hover:border-acc hover:scale-110'}`}
        aria-label={todo.done ? 'Mark incomplete' : 'Mark complete'}
      >
        {todo.done && (
          <svg className="w-2.5 h-2.5 text-accon" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="w-full text-sm text-fg1 bg-transparent outline-none border-b-2 border-acc pb-0.5"
            autoFocus
          />
        ) : (
          <p
            onDoubleClick={() => { setEditing(true); setEditText(todo.text) }}
            title="Double-click to edit"
            className={`text-sm leading-snug cursor-default select-none
              ${todo.done ? 'line-through text-fg3' : 'text-fg1'}`}
          >
            {todo.text}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg ${PRIORITY_BADGE[todo.priority]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[todo.priority]}`} />
            {todo.priority}
          </span>
          {todo.dueDate && (
            <span className={`text-[11px] font-medium flex items-center gap-1
              ${isOverdue ? 'text-red-500 dark:text-red-400' : 'text-fg3'}`}>
              {isOverdue && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              )}
              {isOverdue ? 'Overdue · ' : 'Due '}
              {new Date(todo.dueDate + 'T00:00:00').toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </span>
          )}
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-fg3 hover:text-red-500
          transition-all duration-150 shrink-0 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 mt-0.5"
        title="Delete task"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
