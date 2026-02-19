import { useCallback } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { InterviewApplication } from '../../types/interview'
import { generateId } from '../../utils/ids'
import { toISODate } from '../../utils/date'
import { exportToExcel, importFromExcel } from './ExcelUtils'

const STORAGE_KEY = 'myservices_applications'

export function useApplications() {
  const [applications, setApplications] = useLocalStorage<InterviewApplication[]>(STORAGE_KEY, [])

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
    },
    [setApplications]
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
