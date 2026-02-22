import { useState, useMemo, useRef } from 'react'
import { useApplications } from './useApplications'
import ApplicationCard from './ApplicationCard'
import ApplicationForm from './ApplicationForm'
import FilterBar, { Filters } from './FilterBar'
import Button from '../../components/ui/Button'
import { InterviewApplication, ApplicationStatus } from '../../types/interview'

const emptyFilters: Filters = {
  search: '',
  statuses: new Set<ApplicationStatus>(),
  dateFrom: '',
  dateTo: '',
}

export default function InterviewTracker() {
  const { applications, addApplication, updateApplication, deleteApplication, exportExcel, importExcel, storageSize } =
    useApplications()
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<InterviewApplication | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [importError, setImportError] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    return applications.filter((a) => {
      const q = filters.search.toLowerCase()
      if (q && !a.company.toLowerCase().includes(q) && !a.position.toLowerCase().includes(q)) return false
      if (filters.statuses.size > 0 && !filters.statuses.has(a.status)) return false
      if (filters.dateFrom && a.applicationDate < filters.dateFrom) return false
      if (filters.dateTo && a.applicationDate > filters.dateTo) return false
      return true
    })
  }, [applications, filters])

  const handleEdit = (app: InterviewApplication) => {
    setEditTarget(app)
    setFormOpen(true)
  }

  const handleSave = (data: Omit<InterviewApplication, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editTarget) {
      updateApplication(editTarget.id, data)
    } else {
      addApplication(data)
    }
    setEditTarget(null)
    setFormOpen(false)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setImportError(null)
      await importExcel(file)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  const sizeMB = parseFloat(storageSize())

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-fg1">Applications</h2>
          <p className="text-sm text-fg2">
            {applications.length} total · {filtered.length} shown
            {sizeMB > 3 && (
              <span className="ml-2 text-orange-500 font-medium">⚠ Storage: {sizeMB} MB</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={exportExcel} disabled={applications.length === 0}>
            Export Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => importRef.current?.click()}>
            Import Excel
          </Button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          <Button size="sm" onClick={() => { setEditTarget(null); setFormOpen(true) }}>
            + Add Application
          </Button>
        </div>
      </div>

      {importError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-sm px-4 py-2 rounded-lg">
          Import error: {importError}
        </div>
      )}

      <FilterBar filters={filters} onChange={setFilters} onClear={() => setFilters(emptyFilters)} />

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-fg3">
          {applications.length === 0
            ? <p>No applications yet. Add your first one!</p>
            : <p>No applications match the current filters.</p>
          }
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <ApplicationCard
              key={app.id}
              application={app}
              onEdit={() => handleEdit(app)}
              onDelete={() => deleteApplication(app.id)}
            />
          ))}
        </div>
      )}

      <ApplicationForm
        key={editTarget?.id ?? 'new'}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null) }}
        onSave={handleSave}
        initial={editTarget}
      />
    </div>
  )
}
