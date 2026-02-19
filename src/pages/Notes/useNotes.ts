import { useLocalStorage } from '../../hooks/useLocalStorage'
import { generateId } from '../../utils/ids'

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
  }

  return { notes, addNote, updateNote, deleteNote }
}
