import { useCallback, useEffect, useRef } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../services/api'
import { InterviewApplication } from '../../types/interview'
import { generateId } from '../../utils/ids'
import { toISODate } from '../../utils/date'
import { exportToExcel, importFromExcel } from './ExcelUtils'

const STORAGE_KEY = 'myservices_applications'

export function useApplications() {
  const [applications, setApplications] = useLocalStorage<InterviewApplication[]>(STORAGE_KEY, [])
  const { isAuthenticated } = useAuth()
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from server on mount when authenticated
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    api.getApplications()
      .then((res: { applications: InterviewApplication[] }) => {
        if (cancelled || !Array.isArray(res.applications) || res.applications.length === 0) return
        setApplications(prev => {
          const merged: InterviewApplication[] = [...res.applications]
          const seenIds = new Set(res.applications.map(a => a.id))
          for (const a of prev) {
            if (!seenIds.has(a.id)) merged.push(a)
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
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      api.syncApplications(applications).catch(() => {})
    }, 1500)
    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current) }
  }, [applications, isAuthenticated])

  const addApplication = useCallback(
    (data: Omit<InterviewApplication, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const app: InterviewApplication = {
        ...data,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }
      setApplications((prev) => [app, ...prev])
      return app
    },
    [setApplications]
  )

  const updateApplication = useCallback(
    (id: string, data: Partial<Omit<InterviewApplication, 'id' | 'createdAt'>>) => {
      setApplications((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, ...data, updatedAt: new Date().toISOString() }
            : a
        )
      )
    },
    [setApplications]
  )

  const deleteApplication = useCallback(
    (id: string) => {
      setApplications((prev) => prev.filter((a) => a.id !== id))
      if (isAuthenticated) {
        api.deleteApplication(id).catch(() => {})
      }
    },
    [setApplications, isAuthenticated]
  )

  const exportExcel = useCallback(() => {
    exportToExcel(applications)
  }, [applications])

  const importExcel = useCallback(
    async (file: File) => {
      const imported = await importFromExcel(file)
      setApplications(imported)
    },
    [setApplications]
  )

  const storageSize = useCallback(() => {
    const raw = localStorage.getItem(STORAGE_KEY) ?? ''
    return (new Blob([raw]).size / 1024 / 1024).toFixed(2)
  }, [])

  const emptyApplication = useCallback(
    (): Omit<InterviewApplication, 'id' | 'createdAt' | 'updatedAt'> => ({
      company: '',
      position: '',
      applicationDate: toISODate(),
      url: '',
      contactPerson: '',
      contactEmail: '',
      rounds: [],
      status: 'Applied',
      salaryRange: { min: null, max: null, currency: 'USD' },
      locationType: 'Remote',
      source: '',
      notes: '',
    }),
    []
  )

  return {
    applications,
    addApplication,
    updateApplication,
    deleteApplication,
    exportExcel,
    importExcel,
    storageSize,
    emptyApplication,
  }
}
