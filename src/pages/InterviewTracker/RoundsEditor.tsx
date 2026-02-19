import { InterviewRound, RoundType, RoundOutcome } from '../../types/interview'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'

const ROUND_TYPES: RoundType[] = ['Phone Screen', 'Technical', 'Behavioral', 'System Design', 'Take-Home', 'HR', 'Final', 'Other']
const OUTCOMES: { value: RoundOutcome | ''; label: string }[] = [
  { value: '', label: 'Select outcome' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Passed', label: 'Passed' },
  { value: 'Failed', label: 'Failed' },
  { value: 'Withdrawn', label: 'Withdrawn' },
]

interface RoundsEditorProps {
  rounds: InterviewRound[]
  onChange: (rounds: InterviewRound[]) => void
}

function emptyRound(num: number): InterviewRound {
  return { round_number: num, type: 'Phone Screen', date: '', interviewer: '', notes: '', outcome: 'Pending' }
}

export default function RoundsEditor({ rounds, onChange }: RoundsEditorProps) {
  const add = () => onChange([...rounds, emptyRound(rounds.length + 1)])

  const update = (i: number, field: keyof InterviewRound, value: string | number) => {
    onChange(rounds.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }

  const remove = (i: number) => {
    onChange(rounds.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, round_number: idx + 1 })))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-fg1">Interview Rounds ({rounds.length})</span>
        <Button variant="secondary" size="sm" onClick={add}>+ Add Round</Button>
      </div>

      {rounds.map((round, i) => (
        <div key={i} className="border border-line rounded-lg p-3 space-y-3 bg-raised">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg3 uppercase tracking-wide">Round {round.round_number}</span>
            <Button variant="danger" size="sm" onClick={() => remove(i)}>Remove</Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={round.type} onChange={(e) => update(i, 'type', e.target.value)} options={ROUND_TYPES.map((t) => ({ value: t, label: t }))} />
            <Select label="Outcome" value={round.outcome} onChange={(e) => update(i, 'outcome', e.target.value)} options={OUTCOMES as { value: string; label: string }[]} />
            <Input label="Date" type="date" value={round.date} onChange={(e) => update(i, 'date', e.target.value)} />
            <Input label="Interviewer" value={round.interviewer} placeholder="Name / LinkedIn" onChange={(e) => update(i, 'interviewer', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-fg1 block mb-1">Notes</label>
            <textarea
              className="w-full rounded-md border border-line2 bg-raised text-fg1 placeholder-fg3 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-acc focus:border-acc"
              rows={2}
              value={round.notes}
              placeholder="Topics covered, feedback..."
              onChange={(e) => update(i, 'notes', e.target.value)}
            />
          </div>
        </div>
      ))}

      {rounds.length === 0 && <p className="text-sm text-fg3 italic">No rounds added yet.</p>}
    </div>
  )
}
