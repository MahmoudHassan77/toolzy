import * as XLSX from 'xlsx'
import { InterviewApplication, InterviewRound } from '../../types/interview'

type AppRow = {
  id: string
  company: string
  position: string
  applicationDate: string
  url: string
  contactPerson: string
  contactEmail: string
  status: string
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string
  locationType: string
  source: string
  notes: string
  createdAt: string
  updatedAt: string
}

type RoundRow = {
  applicationId: string
  round_number: number
  type: string
  date: string
  interviewer: string
  notes: string
  outcome: string
}

export function exportToExcel(applications: InterviewApplication[]): void {
  const appRows: AppRow[] = applications.map((a) => ({
    id: a.id,
    company: a.company,
    position: a.position,
    applicationDate: a.applicationDate,
    url: a.url,
    contactPerson: a.contactPerson,
    contactEmail: a.contactEmail,
    status: a.status,
    salaryMin: a.salaryRange.min,
    salaryMax: a.salaryRange.max,
    salaryCurrency: a.salaryRange.currency,
    locationType: a.locationType,
    source: a.source,
    notes: a.notes,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }))

  const roundRows: RoundRow[] = applications.flatMap((a) =>
    a.rounds.map((r) => ({
      applicationId: a.id,
      round_number: r.round_number,
      type: r.type,
      date: r.date,
      interviewer: r.interviewer,
      notes: r.notes,
      outcome: r.outcome,
    }))
  )

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appRows), 'Applications')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(roundRows), 'Rounds')

  const date = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `interview-tracker-${date}.xlsx`)
}

export function importFromExcel(file: File): Promise<InterviewApplication[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })

        const appSheet = wb.Sheets['Applications']
        const roundSheet = wb.Sheets['Rounds']

        if (!appSheet) throw new Error('Missing "Applications" sheet')

        const appRows = XLSX.utils.sheet_to_json<AppRow>(appSheet)
        const roundRows = roundSheet
          ? XLSX.utils.sheet_to_json<RoundRow>(roundSheet)
          : []

        const applications: InterviewApplication[] = appRows.map((row) => {
          const appRounds: InterviewRound[] = roundRows
            .filter((r) => r.applicationId === row.id)
            .map((r) => ({
              round_number: r.round_number,
              type: r.type as InterviewRound['type'],
              date: r.date ?? '',
              interviewer: r.interviewer ?? '',
              notes: r.notes ?? '',
              outcome: (r.outcome ?? '') as InterviewRound['outcome'],
            }))

          return {
            id: row.id ?? crypto.randomUUID(),
            company: row.company ?? '',
            position: row.position ?? '',
            applicationDate: row.applicationDate ?? '',
            url: row.url ?? '',
            contactPerson: row.contactPerson ?? '',
            contactEmail: row.contactEmail ?? '',
            rounds: appRounds,
            status: (row.status ?? 'Applied') as InterviewApplication['status'],
            salaryRange: {
              min: row.salaryMin ?? null,
              max: row.salaryMax ?? null,
              currency: row.salaryCurrency ?? 'USD',
            },
            locationType: (row.locationType ?? 'Remote') as InterviewApplication['locationType'],
            source: row.source ?? '',
            notes: row.notes ?? '',
            createdAt: row.createdAt ?? new Date().toISOString(),
            updatedAt: row.updatedAt ?? new Date().toISOString(),
          }
        })

        resolve(applications)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}
