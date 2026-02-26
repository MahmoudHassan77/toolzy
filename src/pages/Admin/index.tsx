import { useState } from 'react'
import { api } from '../../services/api'
import { useAdminStats, useAdminUsers, useUserDetail } from './useAdmin'
import StatsCards from './StatsCards'
import UsersTable from './UsersTable'
import UserDetailModal from './UserDetailModal'
import type { AdminUser } from './types'

export default function Admin() {
  const { stats, loading: statsLoading, refresh: refreshStats } = useAdminStats()
  const { users, total, page, setPage, search, setSearch, loading: usersLoading, limit, refresh: refreshUsers } = useAdminUsers()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { user: detailUser, contentCounts, content, loading: detailLoading, refresh: refreshDetail, deleteContent } = useUserDetail(selectedUserId)

  const handleDeleteUser = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await api.adminDeleteUser(confirmDelete.id)
      setConfirmDelete(null)
      setSelectedUserId(null)
      refreshUsers()
      refreshStats()
    } catch (e) {
      console.error('Failed to delete user:', e)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg1">Admin Dashboard</h1>
          <p className="text-sm text-fg3 mt-1">Manage users and monitor platform activity</p>
        </div>
      </div>

      {/* Stats overview */}
      <StatsCards stats={stats} loading={statsLoading} />

      {/* Users section */}
      <div>
        <h2 className="text-lg font-semibold text-fg1 mb-3">Users</h2>
        <UsersTable
          users={users}
          total={total}
          page={page}
          limit={limit}
          search={search}
          loading={usersLoading}
          onPageChange={setPage}
          onSearchChange={setSearch}
          onSelectUser={u => setSelectedUserId(u.id)}
          onDeleteUser={u => setConfirmDelete(u)}
        />
      </div>

      {/* User detail modal */}
      {selectedUserId && detailUser && (
        <UserDetailModal
          user={detailUser}
          contentCounts={contentCounts}
          content={content}
          loading={detailLoading}
          onClose={() => setSelectedUserId(null)}
          onRefresh={() => { refreshDetail(); refreshUsers(); refreshStats() }}
          onDeleteContent={deleteContent}
        />
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDelete(null)}>
          <div
            className="bg-surface border border-line rounded-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-fg1 font-semibold mb-2">Delete User</h3>
            <p className="text-sm text-fg2 mb-1">
              Are you sure you want to delete <strong>{confirmDelete.name}</strong> ({confirmDelete.email})?
            </p>
            <p className="text-xs text-red-400 mb-4">
              This will permanently remove the user and all their content.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm bg-raised text-fg2 rounded-lg hover:bg-line transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
