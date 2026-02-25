import { useState, useRef } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { KanbanCard, Subtask, Priority, PRIORITY_META, tagPalette } from './types'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<KanbanCard, 'id' | 'createdAt'>) => void
  initial?: KanbanCard | null
  columnTitle?: string
}

type FormData = Omit<KanbanCard, 'id' | 'createdAt'>

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'urgent']

function subtaskUid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export default function CardModal({ open, onClose, onSave, initial, columnTitle }: Props) {
  const [form, setForm] = useState<FormData>(() => initial
    ? { title: initial.title, description: initial.description, priority: initial.priority, tags: initial.tags, dueDate: initial.dueDate, subtasks: initial.subtasks ?? [] }
    : { title: '', description: '', priority: 'none', tags: [], dueDate: '', subtasks: [] }
  )
  const [tagInput, setTagInput] = useState(initial?.tags.join(', ') ?? '')
  const [titleErr, setTitleErr] = useState('')
  const [newSubtaskText, setNewSubtaskText] = useState('')
  const [editingSubId, setEditingSubId] = useState<string | null>(null)
  const [editingSubText, setEditingSubText] = useState('')
  const editSubRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.title.trim()) { setTitleErr('Title is required'); return }
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
    onSave({ ...form, title: form.title.trim(), tags })
    onClose()
  }

  const parsedTags = tagInput.split(',').map(t => t.trim()).filter(Boolean)

  // ── Subtask helpers ─────────────────────────
  const addSubtask = () => {
    const text = newSubtaskText.trim()
    if (!text) return
    const sub: Subtask = { id: subtaskUid(), text, done: false }
    set('subtasks', [...form.subtasks, sub])
    setNewSubtaskText('')
  }

  const toggleSubtask = (id: string) => {
    set('subtasks', form.subtasks.map(s => s.id === id ? { ...s, done: !s.done } : s))
  }

  const removeSubtask = (id: string) => {
    set('subtasks', form.subtasks.filter(s => s.id !== id))
  }

  const startEditSubtask = (sub: Subtask) => {
    setEditingSubId(sub.id)
    setEditingSubText(sub.text)
    setTimeout(() => editSubRef.current?.focus(), 0)
  }

  const commitEditSubtask = () => {
    if (editingSubId) {
      const text = editingSubText.trim()
      if (text) {
        set('subtasks', form.subtasks.map(s => s.id === editingSubId ? { ...s, text } : s))
      }
      setEditingSubId(null)
      setEditingSubText('')
    }
  }

  const doneCount = form.subtasks.filter(s => s.done).length
  const totalCount = form.subtasks.length

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Card' : `Add Card${columnTitle ? ` — ${columnTitle}` : ''}`}>
      <div className="space-y-4">
        {/* Title */}
        <Input
          label="Title *"
          value={form.title}
          onChange={e => { set('title', e.target.value); setTitleErr('') }}
          error={titleErr}
          placeholder="What needs to be done?"
          autoFocus
        />

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-fg1 block mb-1">Description</label>
          <textarea
            className="w-full rounded-md border border-line2 bg-raised text-fg1 placeholder-fg3 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-acc focus:border-acc"
            rows={3}
            value={form.description}
            placeholder="Optional details..."
            onChange={e => set('description', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Priority */}
          <div>
            <label className="text-sm font-medium text-fg1 block mb-1">Priority</label>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITIES.map(p => {
                const meta = PRIORITY_META[p]
                const active = form.priority === p
                return (
                  <button
                    key={p}
                    onClick={() => set('priority', p)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                    style={{
                      borderColor: active ? meta.color : 'var(--line2)',
                      background: active ? meta.color + '20' : 'transparent',
                      color: active ? meta.color : 'var(--fg2)',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Due date */}
          <Input
            label="Due Date"
            type="date"
            value={form.dueDate}
            onChange={e => set('dueDate', e.target.value)}
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-sm font-medium text-fg1 block mb-1">Tags</label>
          <input
            type="text"
            className="w-full rounded-md border border-line2 bg-raised text-fg1 placeholder-fg3 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-acc focus:border-acc"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            placeholder="frontend, bug, api (comma-separated)"
          />
          {parsedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {parsedTags.map(tag => {
                const p = tagPalette(tag)
                return (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                    style={{ background: p.bg, color: p.fg }}>
                    {tag}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Subtasks / Checklist ───────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-fg1">Subtasks</label>
            {totalCount > 0 && (
              <span className="text-xs font-medium text-fg3">{doneCount}/{totalCount} done</span>
            )}
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="h-1 rounded-full bg-line2 mb-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(doneCount / totalCount) * 100}%`,
                  background: doneCount === 0 ? '#6b7280' : doneCount === totalCount ? '#22c55e' : '#3b82f6',
                }}
              />
            </div>
          )}

          {/* Subtask list */}
          {form.subtasks.length > 0 && (
            <div className="space-y-1 mb-2">
              {form.subtasks.map(sub => (
                <div key={sub.id} className="flex items-center gap-2 group rounded-md px-2 py-1 hover:bg-raised/60">
                  <input
                    type="checkbox"
                    checked={sub.done}
                    onChange={() => toggleSubtask(sub.id)}
                    className="w-3.5 h-3.5 rounded border-line2 text-acc focus:ring-acc shrink-0 cursor-pointer accent-[var(--acc)]"
                  />
                  {editingSubId === sub.id ? (
                    <input
                      ref={editSubRef}
                      className="flex-1 min-w-0 text-sm bg-transparent border-b border-acc outline-none text-fg1 py-0"
                      value={editingSubText}
                      onChange={e => setEditingSubText(e.target.value)}
                      onBlur={commitEditSubtask}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitEditSubtask()
                        if (e.key === 'Escape') { setEditingSubId(null); setEditingSubText('') }
                      }}
                    />
                  ) : (
                    <span
                      className={`flex-1 min-w-0 text-sm cursor-pointer select-none ${sub.done ? 'line-through text-fg3' : 'text-fg1'}`}
                      onDoubleClick={() => startEditSubtask(sub)}
                      title="Double-click to edit"
                    >
                      {sub.text}
                    </span>
                  )}
                  <button
                    onClick={() => removeSubtask(sub.id)}
                    className="w-5 h-5 flex items-center justify-center rounded text-fg3 hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    title="Remove subtask"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add subtask input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="flex-1 min-w-0 rounded-md border border-line2 bg-raised text-fg1 placeholder-fg3 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-acc focus:border-acc"
              placeholder="Add a subtask..."
              value={newSubtaskText}
              onChange={e => setNewSubtaskText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask() } }}
            />
            <button
              onClick={addSubtask}
              disabled={!newSubtaskText.trim()}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-acc text-accon hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>{initial ? 'Save Changes' : 'Add Card'}</Button>
        </div>
      </div>
    </Modal>
  )
}
