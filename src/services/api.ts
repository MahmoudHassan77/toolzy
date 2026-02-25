// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_BASE = ((import.meta as any).env?.VITE_API_URL as string) || 'http://localhost:3001'

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem('myservices_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> ?? {}),
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || res.statusText)
  }
  return res.json()
}

export const api = {
  // Auth
  register: (email: string, password: string, name: string) =>
    apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => apiFetch('/api/auth/me'),
  googleAuth: (token: string) =>
    apiFetch('/api/auth/google', { method: 'POST', body: JSON.stringify({ token }) }),
  githubAuth: (code: string) =>
    apiFetch('/api/auth/github', { method: 'POST', body: JSON.stringify({ code }) }),

  // Boards
  getBoards: () => apiFetch('/api/boards'),
  createBoard: (name: string, data: unknown) =>
    apiFetch('/api/boards', { method: 'POST', body: JSON.stringify({ name, data }) }),
  updateBoard: (id: string, data: unknown) =>
    apiFetch(`/api/boards/${id}`, { method: 'PUT', body: JSON.stringify({ data }) }),
  deleteBoard: (id: string) =>
    apiFetch(`/api/boards/${id}`, { method: 'DELETE' }),

  // Diagrams
  getDiagrams: () => apiFetch('/api/diagrams'),
  createDiagram: (name: string, data: unknown) =>
    apiFetch('/api/diagrams', { method: 'POST', body: JSON.stringify({ name, data }) }),
  updateDiagram: (id: string, data: unknown) =>
    apiFetch(`/api/diagrams/${id}`, { method: 'PUT', body: JSON.stringify({ data }) }),
  deleteDiagram: (id: string) =>
    apiFetch(`/api/diagrams/${id}`, { method: 'DELETE' }),

  // Notes
  getNotes: () => apiFetch('/api/notes'),
  syncNotes: (notes: unknown[]) =>
    apiFetch('/api/notes/sync', { method: 'POST', body: JSON.stringify({ notes }) }),
  createNote: (note: { id: string; title: string; content: string; updatedAt: number }) =>
    apiFetch('/api/notes', { method: 'POST', body: JSON.stringify(note) }),
  updateNote: (id: string, data: { title?: string; content?: string }) =>
    apiFetch(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNote: (id: string) =>
    apiFetch(`/api/notes/${id}`, { method: 'DELETE' }),

  // Todos
  getTodos: () => apiFetch('/api/todos'),
  syncTodos: (todos: unknown[]) =>
    apiFetch('/api/todos/sync', { method: 'POST', body: JSON.stringify({ todos }) }),
  createTodo: (todo: { id: string; text: string; done: boolean; priority: string; dueDate?: string; createdAt: number }) =>
    apiFetch('/api/todos', { method: 'POST', body: JSON.stringify(todo) }),
  updateTodo: (id: string, data: { text?: string; done?: boolean; priority?: string; dueDate?: string | null }) =>
    apiFetch(`/api/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTodo: (id: string) =>
    apiFetch(`/api/todos/${id}`, { method: 'DELETE' }),

  // Calendar Events
  getCalendarEvents: () => apiFetch('/api/calendar'),
  syncCalendarEvents: (events: unknown[]) =>
    apiFetch('/api/calendar/sync', { method: 'POST', body: JSON.stringify({ events }) }),
  createCalendarEvent: (event: { id: string; title: string; date: string; time?: string; color?: string; description?: string }) =>
    apiFetch('/api/calendar', { method: 'POST', body: JSON.stringify(event) }),
  updateCalendarEvent: (id: string, data: { title?: string; date?: string; time?: string | null; color?: string; description?: string }) =>
    apiFetch(`/api/calendar/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCalendarEvent: (id: string) =>
    apiFetch(`/api/calendar/${id}`, { method: 'DELETE' }),

  // Applications (Interview Tracker)
  getApplications: () => apiFetch('/api/applications'),
  syncApplications: (applications: unknown[]) =>
    apiFetch('/api/applications/sync', { method: 'POST', body: JSON.stringify({ applications }) }),
  deleteApplication: (id: string) =>
    apiFetch(`/api/applications/${id}`, { method: 'DELETE' }),

  // Files
  uploadFile: async (file: File) => {
    const token = localStorage.getItem('myservices_token')
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE}/api/files/upload`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    })
    if (!res.ok) throw new Error('Upload failed')
    return res.json()
  },

  getFile: (id: string) => apiFetch(`/api/files/${id}`),

  getFileDownloadUrl: (id: string) => {
    const token = localStorage.getItem('myservices_token')
    return `${API_BASE}/api/files/${id}/download${token ? `?token=${token}` : ''}`
  },
}
