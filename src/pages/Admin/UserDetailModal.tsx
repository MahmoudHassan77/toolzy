import { useState } from 'react'
import { api } from '../../services/api'
import type { AdminUser, UserContent, UserContentCounts } from './types'

const COLLECTION_LABELS: Record<string, string> = {
  notes: 'Notes',
  todos: 'Todos',
  boards: 'Boards',
  diagrams: 'Diagrams',
  calendar_events: 'Calendar Events',
  links: 'Links',
  applications: 'Applications',
  files: 'Files',
}

interface Props {
  user: AdminUser
  contentCounts: UserContentCounts | null
  content: UserContent | null
  loading: boolean
  onClose: () => void
  onRefresh: () => void
  onDeleteContent: (collection: string, itemId: string) => Promise<void>
}

function getItemLabel(collection: string, item: Record<string, unknown>): string {
  switch (collection) {
    case 'notes': return (item.title as string) || 'Untitled Note'
    case 'todos': return (item.text as string) || 'Untitled Todo'
    case 'boards': return (item.name as string) || 'Untitled Board'
    case 'diagrams': return (item.name as string) || 'Untitled Diagram'
    case 'calendar_events': return (item.title as string) || 'Untitled Event'
    case 'links': return (item.title as string) || (item.url as string) || 'Untitled Link'
    case 'applications': {
      const data = item.data as Record<string, unknown> | undefined
      return (data?.company as string) || (data?.position as string) || 'Untitled Application'
    }
    case 'files': return (item.filename as string) || 'Untitled File'
    default: return item.id as string
  }
}

export default function UserDetailModal({ user, contentCounts, content, loading, onClose, onRefresh, onDeleteContent }: Props) {
  const [activeTab, setActiveTab] = useState('notes')
  const [editing, setEditing] = useState(false)
  const [editRole, setEditRole] = useState(user.role)
  const [editDisabled, setEditDisabled] = useState(user.disabled)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.adminUpdateUser(user.id, { role: editRole, disabled: editDisabled })
      onRefresh()
      setEditing(false)
    } catch (e) {
      console.error('Failed to update user:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteItem = async (collection: string, itemId: string) => {
    setDeletingId(itemId)
    try {
      await onDeleteContent(collection, itemId)
    } finally {
      setDeletingId(null)
    }
  }

  const tabs = Object.entries(COLLECTION_LABELS).filter(([key]) => {
    const counts = contentCounts as Record<string, number> | null
    return counts ? counts[key] > 0 : false
  })

  const activeItems = content ? (content as Record<string, Record<string, unknown>[]>)[activeTab] || [] : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-surface border border-line rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-acc/20 text-acc flex items-center justify-center text-sm font-bold shrink-0">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-fg1 font-semibold truncate">{user.name}</h2>
              <p className="text-fg3 text-xs truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-fg3 hover:text-fg1 hover:bg-raised transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User info */}
        <div className="p-5 border-b border-line shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-fg3">Role</span>
              {editing ? (
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="block mt-1 w-full px-2 py-1 bg-base border border-line rounded text-fg1 text-xs"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              ) : (
                <p className="text-fg1 font-medium mt-1">{user.role}</p>
              )}
            </div>
            <div>
              <span className="text-fg3">Provider</span>
              <p className="text-fg1 font-medium mt-1 capitalize">{user.provider}</p>
            </div>
            <div>
              <span className="text-fg3">Status</span>
              {editing ? (
                <select
                  value={editDisabled ? 'disabled' : 'active'}
                  onChange={e => setEditDisabled(e.target.value === 'disabled')}
                  className="block mt-1 w-full px-2 py-1 bg-base border border-line rounded text-fg1 text-xs"
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              ) : (
                <p className={`font-medium mt-1 ${user.disabled ? 'text-red-400' : 'text-green-400'}`}>
                  {user.disabled ? 'Disabled' : 'Active'}
                </p>
              )}
            </div>
            <div>
              <span className="text-fg3">Joined</span>
              <p className="text-fg1 font-medium mt-1">{new Date(user.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1 text-xs bg-acc text-accon rounded-lg hover:bg-acc/90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditRole(user.role); setEditDisabled(user.disabled) }}
                  className="px-3 py-1 text-xs bg-raised text-fg2 rounded-lg hover:bg-line"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-1 text-xs bg-acc/10 text-acc rounded-lg hover:bg-acc/20"
              >
                Edit User
              </button>
            )}
          </div>
        </div>

        {/* Content tabs */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-6 h-6 border-2 border-acc border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            {tabs.length > 0 ? (
              <>
                <div className="flex gap-1 px-5 pt-3 overflow-x-auto shrink-0">
                  {tabs.map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-colors ${
                        activeTab === key
                          ? 'bg-acc text-accon'
                          : 'text-fg3 hover:text-fg1 hover:bg-raised'
                      }`}
                    >
                      {label} ({(contentCounts as Record<string, number>)[key]})
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  <div className="space-y-2">
                    {activeItems.map((item) => (
                      <div
                        key={item.id as string}
                        className="flex items-center justify-between gap-3 px-3 py-2 bg-raised/50 rounded-lg"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-fg1 truncate">{getItemLabel(activeTab, item)}</p>
                          <p className="text-xs text-fg3">
                            {item.created_at ? new Date(item.created_at as string).toLocaleDateString() : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteItem(activeTab, item.id as string)}
                          disabled={deletingId === item.id}
                          className="px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors shrink-0 disabled:opacity-50"
                        >
                          {deletingId === item.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    ))}
                    {activeItems.length === 0 && (
                      <p className="text-sm text-fg3 text-center py-4">No items in this collection.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <p className="text-sm text-fg3">This user has no content.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
