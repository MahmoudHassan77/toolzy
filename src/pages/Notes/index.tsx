import { useState } from 'react'
import { useNotes } from './useNotes'
import NoteTab from './NoteTab'

export default function Notes() {
  const { notes, addNote, updateNote, deleteNote } = useNotes()
  const [activeId, setActiveId] = useState<string>(() => notes[0]?.id ?? '')

  const activeNote = notes.find(n => n.id === activeId) ?? notes[0]

  function handleAdd() {
    const id = addNote()
    setActiveId(id)
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const remaining = notes.filter(n => n.id !== id)
    if (activeId === id) setActiveId(remaining[0]?.id ?? '')
    deleteNote(id)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center border-b border-line bg-raised shrink-0 overflow-x-auto">
        {notes.map(n => (
          <button
            key={n.id}
            onClick={() => setActiveId(n.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm cursor-pointer shrink-0 border-r border-line transition-colors
              ${n.id === activeId
                ? 'bg-surface text-fg1 font-medium'
                : 'text-fg2 hover:bg-surface/60 hover:text-fg1'}`}
          >
            <span className="max-w-[120px] truncate">{n.title}</span>
            {notes.length > 1 && (
              <span
                onClick={e => handleDelete(n.id, e)}
                className="text-fg3 hover:text-red-500 transition-colors text-base leading-none ml-1 cursor-pointer"
                title="Delete note"
              >
                ×
              </span>
            )}
          </button>
        ))}
        <button
          onClick={handleAdd}
          className="px-4 py-2.5 text-fg3 hover:text-acc text-xl shrink-0 hover:bg-surface/60 transition-colors"
          title="New note"
        >
          +
        </button>
      </div>

      {/* Active note content */}
      {activeNote && (
        <NoteTab
          key={activeNote.id}
          note={activeNote}
          onUpdate={patch => updateNote(activeNote.id, patch)}
        />
      )}
    </div>
  )
}
