import { useEffect, useState } from 'react'
import type { AdminUser } from './types'

interface Props {
  users: AdminUser[]
  total: number
  page: number
  limit: number
  search: string
  loading: boolean
  onPageChange: (page: number) => void
  onSearchChange: (search: string) => void
  onSelectUser: (user: AdminUser) => void
  onDeleteUser: (user: AdminUser) => void
}

export default function UsersTable({ users, total, page, limit, search, loading, onPageChange, onSearchChange, onSelectUser, onDeleteUser }: Props) {
  const [searchInput, setSearchInput] = useState(search)
  const totalPages = Math.ceil(total / limit)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(searchInput)
      onPageChange(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-surface border border-line rounded-xl overflow-hidden">
      {/* Search bar */}
      <div className="p-4 border-b border-line">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-base border border-line rounded-lg text-sm text-fg1 placeholder-fg3 focus:outline-none focus:border-acc"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-fg3">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="px-4 py-3" colSpan={6}>
                    <div className="h-5 bg-raised rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-fg3" colSpan={6}>No users found.</td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user.id} className="border-b border-line hover:bg-raised/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-acc/20 text-acc flex items-center justify-center text-xs font-bold shrink-0">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          user.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-fg1 font-medium truncate">{user.name}</p>
                        <p className="text-fg3 text-xs truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      user.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-fg2 capitalize">{user.provider}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      user.disabled ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                    }`}>
                      {user.disabled ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-fg3 text-xs">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectUser(user)}
                        className="px-2 py-1 text-xs bg-acc/10 text-acc rounded hover:bg-acc/20 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => onDeleteUser(user)}
                        className="px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-line">
          <p className="text-xs text-fg3">{total} users total</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-2 py-1 text-xs rounded border border-line text-fg2 hover:bg-raised disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="px-2 text-xs text-fg3">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-2 py-1 text-xs rounded border border-line text-fg2 hover:bg-raised disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
