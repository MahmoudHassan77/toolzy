export type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent'

export interface Subtask {
  id: string
  text: string
  done: boolean
}

export interface KanbanCard {
  id: string
  title: string
  description: string
  priority: Priority
  tags: string[]
  dueDate: string
  createdAt: string
  subtasks: Subtask[]
  archived?: boolean
}

export interface KanbanColumn {
  id: string
  title: string
  color: string
  cardIds: string[]
  wipLimit?: number
}

export interface KanbanBoard {
  id: string
  name: string
  columns: KanbanColumn[]
  cards: Record<string, KanbanCard>
  createdAt: string
}

export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  none:   { label: 'None',   color: '#6b7280' },
  low:    { label: 'Low',    color: '#3b82f6' },
  medium: { label: 'Medium', color: '#f59e0b' },
  high:   { label: 'High',   color: '#f97316' },
  urgent: { label: 'Urgent', color: '#ef4444' },
}

export const COLUMN_COLORS = [
  { label: 'Gray',   value: '#6b7280' },
  { label: 'Blue',   value: '#3b82f6' },
  { label: 'Green',  value: '#22c55e' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Red',    value: '#ef4444' },
  { label: 'Teal',   value: '#14b8a6' },
  { label: 'Pink',   value: '#ec4899' },
]

const TAG_PALETTES = [
  { bg: 'rgba(59,130,246,0.15)',  fg: '#3b82f6' },
  { bg: 'rgba(34,197,94,0.15)',   fg: '#22c55e' },
  { bg: 'rgba(168,85,247,0.15)',  fg: '#a855f7' },
  { bg: 'rgba(249,115,22,0.15)',  fg: '#f97316' },
  { bg: 'rgba(20,184,166,0.15)',  fg: '#14b8a6' },
  { bg: 'rgba(236,72,153,0.15)',  fg: '#ec4899' },
  { bg: 'rgba(245,158,11,0.15)',  fg: '#f59e0b' },
  { bg: 'rgba(239,68,68,0.15)',   fg: '#ef4444' },
]

export function tagPalette(tag: string) {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffff
  return TAG_PALETTES[h % TAG_PALETTES.length]
}
