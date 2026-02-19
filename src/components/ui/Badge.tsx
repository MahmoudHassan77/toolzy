import { ApplicationStatus } from '../../types/interview'

// Each entry: "light classes  dark:override classes"
const statusColors: Record<string, string> = {
  Applied:       'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/60 dark:text-blue-300 dark:border-blue-700/50',
  Screening:     'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/60 dark:text-purple-300 dark:border-purple-700/50',
  'In Progress': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700/50',
  Offer:         'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/60 dark:text-green-300 dark:border-green-700/50',
  Rejected:      'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/60 dark:text-red-300 dark:border-red-700/50',
  Withdrawn:     'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-700/60 dark:text-zinc-300 dark:border-zinc-600/50',
  Passed:        'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/60 dark:text-green-300 dark:border-green-700/50',
  Failed:        'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/60 dark:text-red-300 dark:border-red-700/50',
  Pending:       'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700/50',
}

const defaultColor = 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-700/60 dark:text-zinc-300 dark:border-zinc-600/50'

interface BadgeProps {
  label: string
  status?: ApplicationStatus | string
  className?: string
}

export default function Badge({ label, status, className = '' }: BadgeProps) {
  const colorClass = status ? (statusColors[status] ?? defaultColor) : defaultColor
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${colorClass} ${className}`}
    >
      {label}
    </span>
  )
}
