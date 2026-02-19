import { useState } from 'react'
import { InterviewApplication } from '../../types/interview'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { formatDate } from '../../utils/date'

interface ApplicationCardProps {
  application: InterviewApplication
  onEdit: () => void
  onDelete: () => void
}

export default function ApplicationCard({ application: app, onEdit, onDelete }: ApplicationCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-surface rounded-xl border border-line shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-fg1 truncate">{app.company}</h3>
            <Badge label={app.status} status={app.status} />
            <span className="text-xs text-fg3">{app.locationType}</span>
          </div>
          <p className="text-sm text-fg2 mt-0.5 truncate">{app.position}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-fg3">
            <span>Applied {formatDate(app.applicationDate)}</span>
            {app.source && <span>via {app.source}</span>}
            {(app.salaryRange.min || app.salaryRange.max) && (
              <span>
                {app.salaryRange.currency}{' '}
                {app.salaryRange.min?.toLocaleString() ?? '?'} –{' '}
                {app.salaryRange.max?.toLocaleString() ?? '?'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-fg3">{app.rounds.length} round{app.rounds.length !== 1 ? 's' : ''}</span>
          <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Less' : 'Details'}
          </Button>
          <Button variant="secondary" size="sm" onClick={onEdit}>Edit</Button>
          <Button variant="danger" size="sm" onClick={onDelete}>Delete</Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-line px-5 py-4 bg-raised">
          {app.url && (
            <p className="text-xs text-fg2 mb-2">
              <span className="font-medium text-fg1">URL:</span>{' '}
              <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-acc hover:underline">
                {app.url}
              </a>
            </p>
          )}
          {app.contactPerson && (
            <p className="text-xs text-fg2 mb-2">
              <span className="font-medium text-fg1">Contact:</span> {app.contactPerson}
              {app.contactEmail ? ` (${app.contactEmail})` : ''}
            </p>
          )}
          {app.notes && (
            <p className="text-xs text-fg2 mb-3">
              <span className="font-medium text-fg1">Notes:</span> {app.notes}
            </p>
          )}

          {app.rounds.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-fg3 uppercase tracking-wide mb-2">Rounds</p>
              <div className="space-y-1.5">
                {app.rounds.map((r) => (
                  <div key={r.round_number} className="flex items-start gap-3 text-xs">
                    <span className="text-fg3 w-16 shrink-0">Round {r.round_number}</span>
                    <span className="text-fg1 font-medium w-28 shrink-0">{r.type}</span>
                    {r.date && <span className="text-fg2">{formatDate(r.date)}</span>}
                    {r.outcome && <Badge label={r.outcome} status={r.outcome} />}
                    {r.interviewer && <span className="text-fg3">w/ {r.interviewer}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
