import { useState, useEffect, useCallback } from 'react'
import { api } from '../../services/api'
import type { AdminStats, AdminUser, UserContent, UserContentCounts } from './types'

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.adminGetStats()
      setStats(data.stats)
    } catch (e) {
      console.error('Failed to fetch admin stats:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { stats, loading, refresh }
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const limit = 20

  const fetchUsers = useCallback(async (p: number, s: string) => {
    setLoading(true)
    try {
      const data = await api.adminGetUsers({ page: p, limit, search: s || undefined })
      setUsers(data.users)
      setTotal(data.total)
    } catch (e) {
      console.error('Failed to fetch users:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers(page, search) }, [page, search, fetchUsers])

  const refresh = () => fetchUsers(page, search)

  return { users, total, page, setPage, search, setSearch, loading, limit, refresh }
}

export function useUserDetail(userId: string | null) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [contentCounts, setContentCounts] = useState<UserContentCounts | null>(null)
  const [content, setContent] = useState<UserContent | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchUser = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const [detailData, contentData] = await Promise.all([
        api.adminGetUser(id),
        api.adminGetUserContent(id),
      ])
      setUser(detailData.user)
      setContentCounts(detailData.contentCounts)
      setContent(contentData.content)
    } catch (e) {
      console.error('Failed to fetch user detail:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (userId) fetchUser(userId)
    else { setUser(null); setContentCounts(null); setContent(null) }
  }, [userId, fetchUser])

  const refresh = () => { if (userId) fetchUser(userId) }

  const deleteContent = async (collection: string, itemId: string) => {
    if (!userId) return
    await api.adminDeleteContent(userId, collection, itemId)
    refresh()
  }

  return { user, contentCounts, content, loading, refresh, deleteContent }
}
