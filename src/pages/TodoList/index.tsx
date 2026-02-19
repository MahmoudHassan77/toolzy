import { useState, useMemo } from 'react'
import { useTodos } from './useTodos'
import type { Priority } from './useTodos'
import TodoItem from './TodoItem'

type Filter = 'all' | 'active' | 'done'

const PRIORITY_OPTIONS: { value: Priority; label: string; dot: string }[] = [
  { value: 'high',   label: 'High',   dot: 'bg-red-500' },
  { value: 'medium', label: 'Medium', dot: 'bg-amber-400' },
  { value: 'low',    label: 'Low',    dot: 'bg-sky-400' },
]

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',    label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'done',   label: 'Done' },
]

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

  const doneCount   = todos.filter(t => t.done).length
  const activeCount = todos.filter(t => !t.done).length
  const progress    = todos.length > 0 ? Math.round((doneCount / todos.length) * 100) : 0

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-5">

        {/* Progress card */}
        {todos.length > 0 && (
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-base font-bold text-fg1">{progress}% complete</p>
                <p className="text-xs text-fg3 mt-0.5">{doneCount} of {todos.length} tasks done</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-acc tabular-nums leading-none">{activeCount}</p>
                <p className="text-xs text-fg3 mt-1">remaining</p>
              </div>
            </div>
            <div className="h-2.5 bg-raised rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-acc to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Add task card */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-fg3 mb-3">New Task</p>
          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-fg1
                outline-none focus:border-acc transition-colors placeholder:text-fg3"
            />
            <div className="flex items-center gap-2 flex-wrap">
              {/* Priority pills */}
              <div className="flex gap-1.5 flex-wrap">
                {PRIORITY_OPTIONS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border font-semibold transition-all
                      ${priority === p.value
                        ? 'border-acc bg-acc/10 text-fg1 shadow-sm'
                        : 'border-line text-fg2 hover:border-acc/60 hover:text-fg1'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.dot}`} />
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="rounded-xl border border-line bg-bg px-3 py-1.5 text-xs text-fg1
                  outline-none focus:border-acc transition-colors"
              />
              <button
                type="submit"
                className="ml-auto px-5 py-2 rounded-xl bg-acc text-accon font-bold text-sm
                  hover:bg-acch transition-colors shadow-sm hover:shadow"
              >
                Add Task
              </button>
            </div>
          </form>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 p-1 bg-raised rounded-xl">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-4 py-1.5 text-xs rounded-lg font-bold transition-all
                  ${filter === f.id
                    ? 'bg-surface text-fg1 shadow-sm'
                    : 'text-fg2 hover:text-fg1'}`}
              >
                {f.label}
                {f.id === 'active' && activeCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full
                    bg-acc text-accon text-[9px] font-bold">
                    {activeCount}
                  </span>
                )}
                {f.id === 'done' && doneCount > 0 && (
                  <span className="ml-1.5 text-fg3 font-normal">{doneCount}</span>
                )}
              </button>
            ))}
          </div>

          {doneCount > 0 && (
            <button
              onClick={clearDone}
              className="text-xs text-fg3 hover:text-red-500 font-semibold transition-colors"
            >
              Clear done
            </button>
          )}
        </div>

        {/* Task list */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-fg3 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-raised flex items-center justify-center">
              <svg className="w-7 h-7 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h4" />
              </svg>
            </div>
            <p className="text-sm font-semibold">
              {filter === 'done'
                ? 'No completed tasks yet'
                : filter === 'active'
                ? 'All caught up!'
                : 'No tasks yet — add one above!'}
            </p>
            {filter === 'active' && doneCount > 0 && (
              <p className="text-xs">You've completed all your tasks 🎉</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={() => toggleTodo(todo.id)}
                onDelete={() => deleteTodo(todo.id)}
                onUpdate={patch => updateTodo(todo.id, patch)}
              />
            ))}
          </div>
        )}

        {/* Footer count */}
        {todos.length > 0 && (
          <p className="text-xs text-fg3 text-center pb-2">
            {activeCount} remaining · {doneCount} done · {todos.length} total
          </p>
        )}
      </div>
    </div>
  )
}
