import { useLocalStorage } from '../../hooks/useLocalStorage'

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
  }

  function updateTodo(id: string, patch: Partial<Pick<Todo, 'text' | 'priority' | 'dueDate'>>) {
    setTodos(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))
  }

  function clearDone() {
    setTodos(prev => prev.filter(t => !t.done))
  }

  return { todos, addTodo, toggleTodo, deleteTodo, updateTodo, clearDone }
}
