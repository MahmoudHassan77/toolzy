export interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  provider: string
  avatar_url: string | null
  disabled: boolean
  created_at: string
}

export interface AdminStats {
  users: number
  notes: number
  todos: number
  boards: number
  diagrams: number
  calendarEvents: number
  links: number
  applications: number
}

export interface UserContentCounts {
  [key: string]: number
}

export interface ContentItem {
  id: string
  [key: string]: unknown
}

export interface UserContent {
  [key: string]: ContentItem[]
}
