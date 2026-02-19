import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import RoundsEditor from './RoundsEditor'
import { InterviewApplication, ApplicationStatus, LocationType } from '../../types/interview'

const STATUSES: ApplicationStatus[] = ['Applied', 'Screening', 'In Progress', 'Offer', 'Rejected', 'Withdrawn']
const LOCATIONS: LocationType[] = ['Remote', 'Hybrid', 'On-site']
const SOURCES = ['LinkedIn', 'Indeed', 'Referral', 'Company Site', 'Glassdoor', 'AngelList', 'Other']

interface ApplicationFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<InterviewApplication, 'id' | 'createdAt' | 'updatedAt'>) => void
  initial?: InterviewApplication | null
}

type FormData = Omit<InterviewApplication, 'id' | 'createdAt' | 'updatedAt'>

export default function ApplicationForm({ open, onClose, onSave, initial }: ApplicationFormProps) {
  const [form, setForm] = useState<FormData>(() =>
    initial ? {
      company: initial.company, position: initial.position,
      applicationDate: initial.applicationDate, url: initial.url,
      contactPerson: initial.contactPerson, contactEmail: initial.contactEmail,
      rounds: initial.rounds, status: initial.status,
      salaryRange: initial.salaryRange, locationType: initial.locationType,
      source: initial.source, notes: initial.notes,
    } : {
      company: '', position: '',
      applicationDate: new Date().toISOString().split('T')[0],
      url: '', contactPerson: '', contactEmail: '', rounds: [],
      status: 'Applied', salaryRange: { min: null, max: null, currency: 'USD' },
      locationType: 'Remote', source: '', notes: '',
    }
  )
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!form.company.trim()) e.company = 'Company is required'
    if (!form.position.trim()) e.position = 'Position is required'
    if (!form.applicationDate) e.applicationDate = 'Date is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    onSave(form)
    onClose()
  }

  const sectionHead = 'text-xs font-semibold text-fg3 uppercase tracking-wide mb-3'

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Application' : 'Add Application'} size="xl">
      <div className="space-y-6">
        <section>
          <h3 className={sectionHead}>Basic Info</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Company *" value={form.company} onChange={(e) => set('company', e.target.value)} error={errors.company} placeholder="Acme Corp" />
            <Input label="Position *" value={form.position} onChange={(e) => set('position', e.target.value)} error={errors.position} placeholder="Software Engineer" />
            <Input label="Application Date *" type="date" value={form.applicationDate} onChange={(e) => set('applicationDate', e.target.value)} error={errors.applicationDate} />
            <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value as ApplicationStatus)} options={STATUSES.map((s) => ({ value: s, label: s }))} />
            <Input label="Job URL" value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://..." wrapperClassName="col-span-2" />
          </div>
        </section>

        <section>
          <h3 className={sectionHead}>Contact</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Contact Person" value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} placeholder="Recruiter / HR name" />
            <Input label="Contact Email" type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} placeholder="recruiter@company.com" />
          </div>
        </section>

        <section>
          <h3 className={sectionHead}>Compensation & Details</h3>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Salary Min" type="number" value={form.salaryRange.min ?? ''} onChange={(e) => set('salaryRange', { ...form.salaryRange, min: e.target.value ? Number(e.target.value) : null })} placeholder="80000" />
            <Input label="Salary Max" type="number" value={form.salaryRange.max ?? ''} onChange={(e) => set('salaryRange', { ...form.salaryRange, max: e.target.value ? Number(e.target.value) : null })} placeholder="120000" />
            <Input label="Currency" value={form.salaryRange.currency} onChange={(e) => set('salaryRange', { ...form.salaryRange, currency: e.target.value })} placeholder="USD" />
            <Select label="Location Type" value={form.locationType} onChange={(e) => set('locationType', e.target.value as LocationType)} options={LOCATIONS.map((l) => ({ value: l, label: l }))} />
            <Select label="Source" value={form.source} onChange={(e) => set('source', e.target.value)} options={[{ value: '', label: 'Select source' }, ...SOURCES.map((s) => ({ value: s, label: s }))]} wrapperClassName="col-span-2" />
          </div>
        </section>

        <section>
          <h3 className={sectionHead}>Interview Rounds</h3>
          <RoundsEditor rounds={form.rounds} onChange={(rounds) => set('rounds', rounds)} />
        </section>

        <section>
          <h3 className={sectionHead}>Notes</h3>
          <textarea
            className="w-full rounded-md border border-line2 bg-raised text-fg1 placeholder-fg3 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-acc focus:border-acc"
            rows={3}
            value={form.notes}
            placeholder="Any additional notes..."
            onChange={(e) => set('notes', e.target.value)}
          />
        </section>

        <div className="flex justify-end gap-3 pt-2 border-t border-line">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Application</Button>
        </div>
      </div>
    </Modal>
  )
}
