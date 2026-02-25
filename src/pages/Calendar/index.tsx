import { useState, useMemo, useEffect, useRef, FormEvent } from 'react'
import { KanbanBoard, KanbanCard, Priority, PRIORITY_META } from '../StoryBoard/types'
import { CalendarEvent, useCalendarEvents } from './useCalendarEvents'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Store {
  boards: KanbanBoard[]
  activeBoardId: string | null
}

interface CalendarCard extends KanbanCard {
  boardName: string
  columnTitle: string
}

type CalendarItem =
  | { kind: 'card'; data: CalendarCard }
  | { kind: 'event'; data: CalendarEvent }

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'toolzy_kanban'
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const EVENT_COLORS = [
  { label: 'Blue',   value: '#3b82f6' },
  { label: 'Green',  value: '#22c55e' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Red',    value: '#ef4444' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Pink',   value: '#ec4899' },
  { label: 'Teal',   value: '#14b8a6' },
  { label: 'Yellow', value: '#eab308' },
]

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Store
  } catch { /* ignore */ }
  return { boards: [], activeBoardId: null }
}

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildGrid(year: number, month: number): Date[][] {
  const firstOfMonth = new Date(year, month, 1)
  const startDay = firstOfMonth.getDay()
  const gridStart = new Date(year, month, 1 - startDay)

  const rows: Date[][] = []
  for (let r = 0; r < 6; r++) {
    const row: Date[] = []
    for (let c = 0; c < 7; c++) {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + r * 7 + c)
      row.push(d)
    }
    rows.push(row)
  }
  return rows
}

function priorityClasses(p: Priority): { bg: string; text: string; dot: string } {
  switch (p) {
    case 'urgent': return { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-500' }
    case 'high':   return { bg: 'bg-orange-500/15', text: 'text-orange-400', dot: 'bg-orange-500' }
    case 'medium': return { bg: 'bg-amber-500/15', text: 'text-amber-400', dot: 'bg-amber-500' }
    case 'low':    return { bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-500' }
    default:       return { bg: 'bg-gray-500/15', text: 'text-gray-400', dot: 'bg-gray-500' }
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Calendar() {
  const today = new Date()
  const todayKey = dateKey(today)

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  // Popup state
  const [popup, setPopup] = useState<{ item: CalendarItem; x: number; y: number } | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // Add/edit event modal
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; date: string; event?: CalendarEvent } | null>(null)

  // Calendar events hook
  const { events, addEvent, updateEvent, deleteEvent } = useCalendarEvents()

  // Close popup on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopup(null)
      }
    }
    if (popup) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [popup])

  // Load kanban data from localStorage
  const { cardsByDate, doneCardIds } = useMemo(() => {
    const store = loadStore()
    const map = new Map<string, CalendarCard[]>()
    const doneIds = new Set<string>()

    for (const board of store.boards) {
      const doneCols = new Set<string>()
      for (const col of board.columns) {
        if (col.title.toLowerCase() === 'done') doneCols.add(col.id)
      }
      const cardColMap = new Map<string, string>()
      for (const col of board.columns) {
        for (const cid of col.cardIds) cardColMap.set(cid, col.id)
      }
      for (const [, card] of Object.entries(board.cards)) {
        if (!card.dueDate || card.archived) continue
        const colId = cardColMap.get(card.id)
        const colTitle = colId ? board.columns.find(c => c.id === colId)?.title ?? '' : ''
        if (colId && doneCols.has(colId)) doneIds.add(card.id)
        const entry: CalendarCard = { ...card, boardName: board.name, columnTitle: colTitle }
        const existing = map.get(card.dueDate)
        if (existing) existing.push(entry)
        else map.set(card.dueDate, [entry])
      }
    }
    return { cardsByDate: map, doneCardIds: doneIds }
  }, [year, month])

  // Merge kanban cards and calendar events by date
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    // Add kanban cards
    for (const [date, cards] of cardsByDate) {
      map.set(date, cards.map(c => ({ kind: 'card' as const, data: c })))
    }
    // Add calendar events
    for (const event of events) {
      const existing = map.get(event.date)
      const item: CalendarItem = { kind: 'event', data: event }
      if (existing) existing.push(item)
      else map.set(event.date, [item])
    }
    return map
  }, [cardsByDate, events])

  const grid = useMemo(() => buildGrid(year, month), [year, month])

  function goToday() { setYear(today.getFullYear()); setMonth(today.getMonth()) }
  function goPrev() { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  function goNext() { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  function handleItemClick(item: CalendarItem, e: React.MouseEvent) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    let x = rect.right + 8
    let y = rect.top
    if (x + 300 > window.innerWidth) x = rect.left - 308
    if (y + 260 > window.innerHeight) y = window.innerHeight - 270
    if (y < 8) y = 8
    setPopup({ item, x, y })
  }

  function handleDayClick(date: string) {
    setModal({ mode: 'add', date })
  }

  const totalItems = Array.from(itemsByDate.values()).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-base">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-surface">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-acc" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h1 className="text-lg font-bold text-fg1">Calendar</h1>
          <span className="text-xs text-fg3 ml-1">
            {totalItems} item{totalItems !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-fg2 hover:text-fg1 hover:bg-raised border border-line transition-colors"
          >
            Today
          </button>
          <button onClick={goPrev} className="w-8 h-8 flex items-center justify-center rounded-lg text-fg2 hover:text-fg1 hover:bg-raised transition-colors" aria-label="Previous month">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-sm font-semibold text-fg1 min-w-[140px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={goNext} className="w-8 h-8 flex items-center justify-center rounded-lg text-fg2 hover:text-fg1 hover:bg-raised transition-colors" aria-label="Next month">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-3">
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-fg3 py-1.5">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 grid-rows-6 gap-px bg-line rounded-xl overflow-hidden border border-line">
          {grid.flat().map((date, idx) => {
            const key = dateKey(date)
            const isCurrentMonth = date.getMonth() === month
            const isToday = key === todayKey
            const items = itemsByDate.get(key) || []

            return (
              <div
                key={idx}
                onClick={() => handleDayClick(key)}
                className={`
                  min-h-[100px] p-1.5 flex flex-col transition-colors cursor-pointer group
                  ${isCurrentMonth ? 'bg-surface hover:bg-raised/50' : 'bg-base hover:bg-raised/30'}
                  ${isToday ? 'ring-2 ring-inset ring-acc/50' : ''}
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium leading-none
                    ${isToday ? 'bg-acc text-accon w-6 h-6 rounded-full flex items-center justify-center font-bold' : isCurrentMonth ? 'text-fg1' : 'text-fg3/50'}`}>
                    {date.getDate()}
                  </span>
                  {/* Add button on hover */}
                  <span className="w-4 h-4 flex items-center justify-center rounded text-fg3 opacity-0 group-hover:opacity-100 hover:bg-acc/20 hover:text-acc transition-all text-xs font-bold">+</span>
                </div>

                <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                  {items.slice(0, 3).map(item => {
                    if (item.kind === 'card') {
                      const card = item.data
                      const pc = priorityClasses(card.priority)
                      const isDone = doneCardIds.has(card.id)
                      const isOverdue = !isDone && key < todayKey
                      return (
                        <button key={card.id} onClick={(e) => handleItemClick(item, e)}
                          className={`group/c flex items-center gap-1 px-1.5 py-0.5 rounded text-left text-[11px] leading-tight truncate w-full hover:opacity-80 transition-opacity cursor-pointer ${pc.bg} ${isDone ? 'opacity-50 line-through' : ''} ${isOverdue ? 'ring-1 ring-red-500/40' : ''}`}
                          title={card.title}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pc.dot}`} />
                          <span className={`truncate ${isOverdue ? 'text-red-400' : pc.text}`}>{card.title}</span>
                        </button>
                      )
                    } else {
                      const event = item.data
                      return (
                        <button key={event.id} onClick={(e) => handleItemClick(item, e)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-left text-[11px] leading-tight truncate w-full hover:opacity-80 transition-opacity cursor-pointer"
                          style={{ backgroundColor: `${event.color}20` }}
                          title={event.title}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
                          <span className="truncate" style={{ color: event.color }}>{event.time ? `${event.time} ` : ''}{event.title}</span>
                        </button>
                      )
                    }
                  })}
                  {items.length > 3 && (
                    <span className="text-[10px] text-fg3 px-1.5">+{items.length - 3} more</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-2 border-t border-line bg-surface text-[11px] flex-wrap">
        {(Object.entries(PRIORITY_META) as [Priority, { label: string; color: string }][]).map(([p, meta]) => {
          const pc = priorityClasses(p)
          return (
            <div key={p} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${pc.dot}`} />
              <span className="text-fg3">{meta.label}</span>
            </div>
          )
        })}
        <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-line">
          <span className="w-2 h-2 rounded-full ring-1 ring-red-500/60 bg-transparent" />
          <span className="text-fg3">Overdue</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-line">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-fg3">Event</span>
        </div>
      </div>

      {/* Card / Event Detail Popup */}
      {popup && (
        <div ref={popupRef} className="fixed z-50 w-72 bg-surface border border-line rounded-xl shadow-xl p-4" style={{ left: popup.x, top: popup.y }}>
          {popup.item.kind === 'card' ? (
            <CardPopup card={popup.item.data} doneCardIds={doneCardIds} todayKey={todayKey} onClose={() => setPopup(null)} />
          ) : (
            <EventPopup
              event={popup.item.data}
              onClose={() => setPopup(null)}
              onEdit={() => { const ev = popup.item.data as CalendarEvent; setPopup(null); setModal({ mode: 'edit', date: ev.date, event: ev }) }}
              onDelete={() => { deleteEvent((popup.item.data as CalendarEvent).id); setPopup(null) }}
            />
          )}
        </div>
      )}

      {/* Add / Edit Event Modal */}
      {modal && (
        <EventModal
          mode={modal.mode}
          date={modal.date}
          event={modal.event}
          onSave={(data) => {
            if (modal.mode === 'edit' && modal.event) {
              updateEvent(modal.event.id, data)
            } else {
              addEvent(data)
            }
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Card Popup                                                         */
/* ------------------------------------------------------------------ */

function CardPopup({ card, doneCardIds, todayKey, onClose }: {
  card: CalendarCard
  doneCardIds: Set<string>
  todayKey: string
  onClose: () => void
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-fg1 leading-snug">{card.title}</h3>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded text-fg3 hover:text-fg1 hover:bg-raised shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-fg3 w-16">Priority</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PRIORITY_META[card.priority].color }} />
            <span className="text-fg1">{PRIORITY_META[card.priority].label}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-fg3 w-16">Due</span>
          <span className={`text-fg1 ${!doneCardIds.has(card.id) && card.dueDate < todayKey ? 'text-red-400 font-medium' : ''}`}>
            {card.dueDate}
            {!doneCardIds.has(card.id) && card.dueDate < todayKey && <span className="ml-1 text-red-400">(overdue)</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-fg3 w-16">Board</span>
          <span className="text-fg1">{card.boardName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-fg3 w-16">Column</span>
          <span className="text-fg1">{card.columnTitle}</span>
        </div>
        {card.description && (
          <div className="pt-2 border-t border-line">
            <p className="text-fg2 leading-relaxed whitespace-pre-wrap">{card.description}</p>
          </div>
        )}
        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2">
            {card.tags.map(tag => (
              <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-acc/15 text-acc">{tag}</span>
            ))}
          </div>
        )}
        {card.subtasks.length > 0 && (
          <div className="pt-2 border-t border-line">
            <span className="text-fg3 text-[10px] uppercase tracking-wider font-semibold">
              Subtasks ({card.subtasks.filter(s => s.done).length}/{card.subtasks.length})
            </span>
            <ul className="mt-1 space-y-0.5">
              {card.subtasks.map(st => (
                <li key={st.id} className={`flex items-center gap-1.5 ${st.done ? 'line-through text-fg3' : 'text-fg2'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.done ? 'bg-green-500' : 'bg-fg3/30'}`} />
                  {st.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        {doneCardIds.has(card.id) && (
          <div className="pt-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/15 text-green-400">Completed</span>
          </div>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Event Popup                                                        */
/* ------------------------------------------------------------------ */

function EventPopup({ event, onClose, onEdit, onDelete }: {
  event: CalendarEvent
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
          <h3 className="text-sm font-semibold text-fg1 leading-snug">{event.title}</h3>
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded text-fg3 hover:text-fg1 hover:bg-raised shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-fg3 w-16">Date</span>
          <span className="text-fg1">{event.date}</span>
        </div>
        {event.time && (
          <div className="flex items-center gap-2">
            <span className="text-fg3 w-16">Time</span>
            <span className="text-fg1">{event.time}</span>
          </div>
        )}
        {event.description && (
          <div className="pt-2 border-t border-line">
            <p className="text-fg2 leading-relaxed whitespace-pre-wrap">{event.description}</p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line">
        <button onClick={onEdit} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-fg1 hover:bg-raised border border-line transition-colors">Edit</button>
        <button onClick={onDelete} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 border border-line transition-colors">Delete</button>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Add / Edit Event Modal                                             */
/* ------------------------------------------------------------------ */

function EventModal({ mode, date, event, onSave, onClose }: {
  mode: 'add' | 'edit'
  date: string
  event?: CalendarEvent
  onSave: (data: Omit<CalendarEvent, 'id' | 'createdAt'>) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [eventDate, setEventDate] = useState(event?.date ?? date)
  const [time, setTime] = useState(event?.time ?? '')
  const [color, setColor] = useState(event?.color ?? '#3b82f6')
  const [description, setDescription] = useState(event?.description ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      date: eventDate,
      time: time || undefined,
      color,
      description,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-sm bg-surface border border-line rounded-xl shadow-xl p-5" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-bold text-fg1 mb-4">{mode === 'add' ? 'Add Event' : 'Edit Event'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-fg3 mb-1">Title</label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-line bg-bg text-fg1 text-sm focus:outline-none focus:border-acc"
              placeholder="Event title"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-fg3 mb-1">Date</label>
              <input
                type="date"
                required
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-line bg-bg text-fg1 text-sm focus:outline-none focus:border-acc"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-fg3 mb-1">Time (optional)</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-line bg-bg text-fg1 text-sm focus:outline-none focus:border-acc"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-fg3 mb-1">Color</label>
            <div className="flex items-center gap-1.5">
              {EVENT_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-6 h-6 rounded-full transition-all ${color === c.value ? 'ring-2 ring-offset-2 ring-offset-surface ring-acc scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-fg3 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 rounded-lg border border-line bg-bg text-fg1 text-sm focus:outline-none focus:border-acc resize-none"
              placeholder="Add notes..."
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-fg2 hover:bg-raised border border-line transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-acc text-accon hover:opacity-90 transition-opacity">{mode === 'add' ? 'Add Event' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
