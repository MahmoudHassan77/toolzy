import { useLocalStorage } from '../../hooks/useLocalStorage'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../services/api'
import { useEffect, useRef } from 'react'

export type Priority = 'low' | 'medium' | 'high'

export interface Todo {
  id: string
  text: string
  done: boolean
  priority: Priority
  dueDate?: string
  createdAt: number
}

export function useTodos() {
  const [todos, setTodos] = useLocalStorage<Todo[]>('toolzy-todos', [])
  const { isAuthenticated } = useAuth()
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from server on mount when authenticated
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    api.getTodos()
      .then((res: { todos: Todo[] }) => {
        if (cancelled || !Array.isArray(res.todos) || res.todos.length === 0) return
        setTodos(prev => {
          const serverMap = new Map(res.todos.map(t => [t.id, t]))
          const merged: Todo[] = [...res.todos]
          const seenIds = new Set(res.todos.map(t => t.id))
          for (const t of prev) {
            if (!seenIds.has(t.id)) merged.push(t)
          }
          return merged
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced sync to server
  useEffect(() => {
    if (!isAuthenticated) return
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      api.syncTodos(todos).catch(() => {})
    }, 1500)
    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current) }
  }, [todos, isAuthenticated])

  function addTodo(text: string, priority: Priority, dueDate?: string) {
    setTodos(prev => [
      { id: crypto.randomUUID(), text, done: false, priority, dueDate, createdAt: Date.now() },
      ...prev,
    ])
  }

  function toggleTodo(id: string) {
    setTodos(prev => prev.map(t => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  function deleteTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id))
    if (isAuthenticated) {
      api.deleteTodo(id).catch(() => {})
    }
  }

  function updateTodo(id: string, patch: Partial<Pick<Todo, 'text' | 'priority' | 'dueDate'>>) {
    setTodos(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))
  }

  function clearDone() {
    const doneIds = todos.filter(t => t.done).map(t => t.id)
    setTodos(prev => prev.filter(t => !t.done))
    if (isAuthenticated) {
      for (const id of doneIds) {
        api.deleteTodo(id).catch(() => {})
      }
    }
  }

  return { todos, addTodo, toggleTodo, deleteTodo, updateTodo, clearDone }
}
