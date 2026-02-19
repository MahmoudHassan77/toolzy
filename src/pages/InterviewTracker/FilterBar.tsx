import { ApplicationStatus } from '../../types/interview'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

const ALL_STATUSES: ApplicationStatus[] = ['Applied', 'Screening', 'In Progress', 'Offer', 'Rejected', 'Withdrawn']

export interface Filters {
  search: string
  statuses: Set<ApplicationStatus>
  dateFrom: string
  dateTo: string
}

interface FilterBarProps {
  filters: Filters
  onChange: (f: Filters) => void
  onClear: () => void
}

export default function FilterBar({ filters, onChange, onClear }: FilterBarProps) {
  const toggleStatus = (s: ApplicationStatus) => {
    const next = new Set(filters.statuses)
    if (next.has(s)) next.delete(s)
    else next.add(s)
    onChange({ ...filters, statuses: next })
  }

  return (
    <div className="bg-surface border border-line rounded-xl px-4 py-3 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Search company or position..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="min-w-48"
        />
        <Input
          type="date"
          label=""
          title="From date"
          value={filters.dateFrom}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
        />
        <span className="text-fg3 text-sm">–</span>
        <Input
          type="date"
          label=""
          title="To date"
          value={filters.dateTo}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
        />
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => toggleStatus(s)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
              ${filters.statuses.has(s)
                ? 'bg-acc text-accon border-acc'
                : 'bg-raised text-fg2 border-line2 hover:border-acc hover:text-acc'
              }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
