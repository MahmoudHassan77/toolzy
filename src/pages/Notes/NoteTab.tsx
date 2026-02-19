import { useState, useEffect, useRef } from 'react'
import type { Note } from './useNotes'

interface Props {
  note: Note
  onUpdate: (patch: Partial<Pick<Note, 'title' | 'content'>>) => void
}

export default function NoteTab({ note, onUpdate }: Props) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(note.title)
  const titleRef = useRef<HTMLInputElement>(null)

  // Sync title when note changes (switching tabs)
  useEffect(() => {
    setTitle(note.title)
    setEditingTitle(false)
  }, [note.id, note.title])

  function commitTitle() {
    setEditingTitle(false)
    const trimmed = title.trim() || 'Untitled'
    setTitle(trimmed)
    onUpdate({ title: trimmed })
  }

  const wordCount = note.content.trim() ? note.content.trim().split(/\s+/).length : 0
  const charCount = note.content.length

  return (
    <div className="flex flex-col h-full">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line shrink-0">
        {editingTitle ? (
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') commitTitle()
              if (e.key === 'Escape') { setTitle(note.title); setEditingTitle(false) }
            }}
            className="flex-1 text-sm font-semibold text-fg1 bg-transparent outline-none border-b border-acc pb-0.5"
            autoFocus
          />
        ) : (
          <button
            onClick={() => {
              setEditingTitle(true)
              setTimeout(() => titleRef.current?.select(), 0)
            }}
            className="text-sm font-semibold text-fg1 hover:text-acc transition-colors text-left truncate"
            title="Click to rename"
          >
            {note.title}
          </button>
        )}
      </div>

      {/* Content area */}
      <textarea
        value={note.content}
        onChange={e => onUpdate({ content: e.target.value })}
        placeholder="Start writing..."
        className="flex-1 resize-none p-4 text-sm text-fg1 bg-bg outline-none leading-relaxed"
      />

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-line text-[11px] text-fg3 flex items-center gap-4 shrink-0">
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
        <span className="ml-auto">
          Updated {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
