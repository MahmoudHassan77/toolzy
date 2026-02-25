import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../services/api'

export interface CalendarEvent {
  id: string
  title: string
  date: string      // YYYY-MM-DD
  time?: string     // HH:mm
  color: string
  description: string
  createdAt: string
}

const STORAGE_KEY = 'toolzy_calendar_events'

function uid(): string {
  return crypto.randomUUID()
}

function load(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as CalendarEvent[]
  } catch { /* ignore */ }
  return []
}

function persist(events: CalendarEvent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
}

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>(load)
  const { isAuthenticated } = useAuth()
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from server on mount when authenticated
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    api.getCalendarEvents()
      .then((res: { events: CalendarEvent[] }) => {
        if (cancelled || !Array.isArray(res.events) || res.events.length === 0) return
        setEvents(prev => {
          const serverMap = new Map(res.events.map(e => [e.id, e]))
          const merged: CalendarEvent[] = [...res.events]
          const seenIds = new Set(res.events.map(e => e.id))
          for (const e of prev) {
            if (!seenIds.has(e.id)) merged.push(e)
          }
          persist(merged)
          return merged
        })
      })
      .catch(() => { /* offline */ })
    return () => { cancelled = true }
  }, [isAuthenticated])

  // Debounced sync to server
  useEffect(() => {
    if (!isAuthenticated) return
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      api.syncCalendarEvents(events).catch(() => {})
    }, 1000)
    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current) }
  }, [events, isAuthenticated])

  const addEvent = useCallback((data: Omit<CalendarEvent, 'id' | 'createdAt'>) => {
    const event: CalendarEvent = {
      ...data,
      id: uid(),
      createdAt: new Date().toISOString(),
    }
    setEvents(prev => {
      const next = [...prev, event]
      persist(next)
      return next
    })
    return event
  }, [])

  const updateEvent = useCallback((id: string, patch: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>) => {
    setEvents(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...patch } : e)
      persist(next)
      return next
    })
  }, [])

  const deleteEvent = useCallback((id: string) => {
    setEvents(prev => {
      const next = prev.filter(e => e.id !== id)
      persist(next)
      return next
    })
    if (isAuthenticated) {
      api.deleteCalendarEvent(id).catch(() => {})
    }
  }, [isAuthenticated])

  return { events, addEvent, updateEvent, deleteEvent }
}
