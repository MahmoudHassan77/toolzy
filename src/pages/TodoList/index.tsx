import { useState, useMemo } from 'react'
import { useTodos } from './useTodos'
import type { Priority } from './useTodos'
import TodoItem from './TodoItem'

type Filter = 'all' | 'active' | 'done'

const PRIORITY_OPTIONS: Priority[] = ['high', 'medium', 'low']

export default function TodoList() {
  const { todos, addTodo, toggleTodo, deleteTodo, updateTodo, clearDone } = useTodos()
  const [filter, setFilter] = useState<Filter>('all')
  const [text, setText] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState('')

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    addTodo(text.trim(), priority, dueDate || undefined)
    setText('')
    setDueDate('')
  }

  const filtered = useMemo(() => {
    switch (filter) {
      case 'active': return todos.filter(t => !t.done)
      case 'done':   return todos.filter(t => t.done)
      default:       return todos
    }
  }, [todos, filter])

  const doneCount = todos.filter(t => t.done).length
  const activeCount = todos.filter(t => !t.done).length

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      {/* Add form */}
      <form onSubmit={handleAdd} className="px-6 py-4 border-b border-line bg-surface shrink-0">
        <div className="flex gap-2 mb-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg1 outline-none focus:border-acc"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-acc text-accon font-medium text-sm hover:bg-acch transition-colors shrink-0"
          >
            Add
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as Priority)}
            className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs text-fg1 outline-none focus:border-acc"
          >
            {PRIORITY_OPTIONS.map(p => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)} Priority
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs text-fg1 outline-none focus:border-acc"
          />
        </div>
      </form>

      {/* Filter tabs */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-line shrink-0">
        <div className="flex gap-1 p-0.5 bg-raised rounded-lg">
          {(['all', 'active', 'done'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-md font-medium capitalize transition-colors
                ${filter === f ? 'bg-surface text-fg1 shadow-sm' : 'text-fg2 hover:text-fg1'}`}
            >
              {f}
              {f === 'active' && activeCount > 0 && (
                <span className="ml-1 text-acc">{activeCount}</span>
              )}
              {f === 'done' && doneCount > 0 && (
                <span className="ml-1 text-fg3">{doneCount}</span>
              )}
            </button>
          ))}
        </div>
        {doneCount > 0 && (
          <button
            onClick={clearDone}
            className="text-xs text-fg3 hover:text-fg1 transition-colors"
          >
            Clear done
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-fg3 gap-2 py-16">
            <svg className="w-10 h-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h4" />
            </svg>
            <p className="text-sm">
              {filter === 'done'
                ? 'No completed tasks'
                : filter === 'active'
                ? 'No active tasks'
                : 'No tasks yet — add one above!'}
            </p>
          </div>
        ) : (
          filtered.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={() => toggleTodo(todo.id)}
              onDelete={() => deleteTodo(todo.id)}
              onUpdate={patch => updateTodo(todo.id, patch)}
            />
          ))
        )}
      </div>

      {todos.length > 0 && (
        <div className="px-6 py-2 border-t border-line text-xs text-fg3 shrink-0">
          {activeCount} remaining · {doneCount} done
        </div>
      )}
    </div>
  )
}
