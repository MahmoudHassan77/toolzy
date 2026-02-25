import { useLocalStorage } from '../../hooks/useLocalStorage'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../services/api'
import { generateId } from '../../utils/ids'
import { useEffect, useRef } from 'react'

export interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
}

function newNote(): Note {
  return { id: generateId(), title: 'Untitled', content: '', updatedAt: Date.now() }
}

export function useNotes() {
  const [notes, setNotes] = useLocalStorage<Note[]>('toolzy-notes', [newNote()])
  const { isAuthenticated } = useAuth()
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from server on mount when authenticated
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    api.getNotes()
      .then((res: { notes: Array<{ id: string; title: string; content: string; updated_at: string }> }) => {
        if (cancelled || !Array.isArray(res.notes) || res.notes.length === 0) return
        const serverNotes: Note[] = res.notes.map(n => ({
          id: n.id,
          title: n.title,
          content: n.content,
          updatedAt: new Date(n.updated_at).getTime(),
        }))
        setNotes(prev => {
          const serverMap = new Map(serverNotes.map(n => [n.id, n]))
          const merged: Note[] = [...serverNotes]
          const seenIds = new Set(serverNotes.map(n => n.id))
          for (const n of prev) {
            if (!seenIds.has(n.id)) merged.push(n)
          }
          return merged.length > 0 ? merged : [newNote()]
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
      api.syncNotes(notes).catch(() => {})
    }, 1500)
    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current) }
  }, [notes, isAuthenticated])

  function addNote(): string {
    const note = newNote()
    setNotes(prev => [...prev, note])
    return note.id
  }

  function updateNote(id: string, patch: Partial<Pick<Note, 'title' | 'content'>>) {
    setNotes(prev =>
      prev.map(n => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n))
    )
  }

  function deleteNote(id: string) {
    setNotes(prev => {
      const next = prev.filter(n => n.id !== id)
      return next.length > 0 ? next : [newNote()]
    })
    if (isAuthenticated) {
      api.deleteNote(id).catch(() => {})
    }
  }

  return { notes, addNote, updateNote, deleteNote }
}
