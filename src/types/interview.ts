export type ApplicationStatus =
  | 'Applied'
  | 'Screening'
  | 'In Progress'
  | 'Offer'
  | 'Rejected'
  | 'Withdrawn'

export type LocationType = 'Remote' | 'Hybrid' | 'On-site'

export type RoundType =
  | 'Phone Screen'
  | 'Technical'
  | 'Behavioral'
  | 'System Design'
  | 'Take-Home'
  | 'HR'
  | 'Final'
  | 'Other'

export type RoundOutcome = 'Passed' | 'Failed' | 'Pending' | 'Withdrawn' | ''

export interface InterviewRound {
  round_number: number
  type: RoundType
  date: string
  interviewer: string
  notes: string
  outcome: RoundOutcome
}

export interface InterviewApplication {
  id: string
  company: string
  position: string
  applicationDate: string
  url: string
  contactPerson: string
  contactEmail: string
  rounds: InterviewRound[]
  status: ApplicationStatus
  salaryRange: { min: number | null; max: number | null; currency: string }
  locationType: LocationType
  source: string
  notes: string
  createdAt: string
  updatedAt: string
}
