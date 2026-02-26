import { useLocalStorage } from '../../hooks/useLocalStorage'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../services/api'
import { generateId } from '../../utils/ids'
import { useEffect, useRef, useMemo, useCallback } from 'react'
import type { LinkItem } from './types'

export function useLinks() {
  const [links, setLinks] = useLocalStorage<LinkItem[]>('toolzy-links', [])
  const { isAuthenticated } = useAuth()
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const linksRef = useRef(links)
  const dirtyRef = useRef(false)
  linksRef.current = links

  const flushSync = useCallback(() => {
    if (!dirtyRef.current) return
    dirtyRef.current = false
    if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null }
    api.syncLinks(linksRef.current).catch(() => {})
  }, [])

  // Sync from server on mount when authenticated
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    api.getLinks()
      .then((res: { links: Array<{ id: string; url: string; title: string; category: string; description: string; tags: string; favicon: string; updated_at: string; created_at: string }> }) => {
        if (cancelled || !Array.isArray(res.links) || res.links.length === 0) return
        const serverLinks: LinkItem[] = res.links.map(l => ({
          id: l.id,
          url: l.url,
          title: l.title,
          category: l.category,
          description: l.description,
          tags: l.tags ? JSON.parse(l.tags) : [],
          favicon: l.favicon,
          createdAt: new Date(l.created_at).getTime(),
          updatedAt: new Date(l.updated_at).getTime(),
        }))
        setLinks(prev => {
          const seenIds = new Set(serverLinks.map(l => l.id))
          const merged: LinkItem[] = [...serverLinks]
          for (const l of prev) {
            if (!seenIds.has(l.id)) merged.push(l)
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
    dirtyRef.current = true
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      dirtyRef.current = false
      api.syncLinks(links).catch(() => {})
    }, 1500)
    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current) }
  }, [links, isAuthenticated])

  // Flush pending sync on unmount or page unload
  useEffect(() => {
    const handleBeforeUnload = () => flushSync()
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      flushSync()
    }
  }, [flushSync])

  const categories = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of links) {
      const cat = l.category || 'Uncategorized'
      map.set(cat, (map.get(cat) || 0) + 1)
    }
    return map
  }, [links])

  function addLink(data: Omit<LinkItem, 'id' | 'createdAt' | 'updatedAt'>): string {
    const now = Date.now()
    const link: LinkItem = { ...data, id: generateId(), createdAt: now, updatedAt: now }
    setLinks(prev => [link, ...prev])
    return link.id
  }

  function updateLink(id: string, patch: Partial<Omit<LinkItem, 'id' | 'createdAt'>>) {
    setLinks(prev =>
      prev.map(l => (l.id === id ? { ...l, ...patch, updatedAt: Date.now() } : l))
    )
  }

  function deleteLink(id: string) {
    setLinks(prev => prev.filter(l => l.id !== id))
    if (isAuthenticated) {
      api.deleteLink(id).catch(() => {})
    }
  }

  function renameCategory(oldName: string, newName: string) {
    setLinks(prev =>
      prev.map(l => (l.category === oldName ? { ...l, category: newName, updatedAt: Date.now() } : l))
    )
  }

  return { links, categories, addLink, updateLink, deleteLink, renameCategory }
}
