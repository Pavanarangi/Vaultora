import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAllProfiles, updateUserRole } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { formatDateTime } from '../lib/utils'
import { Shield, Users, Settings } from 'lucide-react'
import { cn } from '../lib/utils'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import type { UserRole } from '../types/database'

export default function AdminPage() {
  const { profile } = useAuthStore()
  const queryClient = useQueryClient()
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: fetchAllProfiles,
  })

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (userId === profile?.id) {
      toast.error("You cannot change your own role")
      return
    }
    setUpdatingRole(userId)
    try {
      await updateUserRole(userId, newRole)
      queryClient.invalidateQueries({ queryKey: ['all-profiles'] })
      toast.success(`Role updated to ${newRole}`)
    } catch {
      toast.error('Failed to update role')
    } finally {
      setUpdatingRole(null)
    }
  }

  const roleBadge = {
    administrator: 'badge-admin',
    owner: 'badge-owner',
    viewer: 'badge-viewer',
  }

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-400" />
          Admin Dashboard
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">Manage users, roles, and system settings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Users', value: users.length, icon: Users, color: 'text-brand-400', bg: 'bg-brand-600/10' },
          { label: 'Administrators', value: users.filter(u => u.role === 'administrator').length, icon: Shield, color: 'text-purple-400', bg: 'bg-purple-600/10' },
          { label: 'Owners', value: users.filter(u => u.role === 'owner').length, icon: Settings, color: 'text-green-400', bg: 'bg-green-600/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card">
            <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* User Management */}
      <div className="card">
        <div className="p-5 border-b border-surface-600">
          <h2 className="section-title">User Management</h2>
          <p className="section-subtitle">Assign roles to control user capabilities</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-700 border-b border-surface-600">
              <tr>
                <th className="table-header">User</th>
                <th className="table-header">Current Role</th>
                <th className="table-header">Joined</th>
                <th className="table-header text-right">Change Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-surface-700/50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-600/20 flex items-center justify-center text-sm font-semibold text-brand-400">
                        {(user.full_name?.[0] ?? user.email[0]).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-200">
                          {user.full_name ?? user.email}
                          {user.id === profile?.id && (
                            <span className="ml-2 text-xs text-gray-500">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={cn(roleBadge[user.role])}>
                      {user.role}
                    </span>
                  </td>
                  <td className="table-cell text-gray-400 text-xs">
                    {formatDateTime(user.created_at)}
                  </td>
                  <td className="table-cell text-right">
                    {user.id !== profile?.id ? (
                      <div className="flex items-center justify-end gap-2">
                        {updatingRole === user.id ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <select
                            value={user.role}
                            onChange={e => handleRoleChange(user.id, e.target.value as UserRole)}
                            className="input text-xs w-36 py-1.5"
                            id={`role-select-${user.id}`}
                          >
                            <option value="viewer">viewer</option>
                            <option value="owner">owner</option>
                            <option value="administrator">administrator</option>
                          </select>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">Cannot change own role</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 p-4 card text-sm text-gray-500">
        <p className="font-semibold text-gray-400 mb-1">Role Capabilities</p>
        <ul className="space-y-1">
          <li><span className={cn('badge-viewer mr-2')}>viewer</span>Can only view documents explicitly shared with them</li>
          <li><span className={cn('badge-owner mr-2')}>owner</span>Can upload, edit, delete own documents; grant/revoke access</li>
          <li><span className={cn('badge-admin mr-2')}>administrator</span>Full access: all documents, all users, all audit logs</li>
        </ul>
      </div>
    </div>
  )
}
