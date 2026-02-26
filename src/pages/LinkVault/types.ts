export interface LinkItem {
  id: string
  url: string
  title: string
  category: string
  description: string
  tags: string[]
  favicon: string
  createdAt: number
  updatedAt: number
}

export const DEFAULT_CATEGORY_SUGGESTIONS = [
  'General',
  'Work',
  'Learning',
  'Design',
  'Development',
  'News',
  'Social',
  'Entertainment',
]
