import { useState } from 'react'
import type { Todo, Priority } from './useTodos'

const PRIORITY_STYLES: Record<Priority, string> = {
  high:   'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700/40',
  medium: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700/40',
  low:    'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700/40',
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

  const isOverdue = todo.dueDate && !todo.done && new Date(todo.dueDate) < new Date()

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border-b border-line hover:bg-raised transition-colors group
        ${todo.done ? 'opacity-55' : ''}`}
    >
      <input
        type="checkbox"
        checked={todo.done}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 rounded accent-acc cursor-pointer shrink-0"
      />

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
            className="w-full text-sm text-fg1 bg-transparent outline-none border-b border-acc pb-0.5"
            autoFocus
          />
        ) : (
          <span
            onDoubleClick={() => { setEditing(true); setEditText(todo.text) }}
            className={`text-sm cursor-default select-none ${todo.done ? 'line-through text-fg3' : 'text-fg1'}`}
          >
            {todo.text}
          </span>
        )}

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border capitalize ${PRIORITY_STYLES[todo.priority]}`}>
            {todo.priority}
          </span>
          {todo.dueDate && (
            <span className={`text-[11px] ${isOverdue ? 'text-red-500 font-medium' : 'text-fg3'}`}>
              {isOverdue ? 'Overdue · ' : 'Due '}
              {todo.dueDate}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onDelete}
        className="text-fg3 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 p-0.5"
        title="Delete"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
