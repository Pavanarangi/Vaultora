import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAuditLogs } from '../lib/api'
import { formatDateTime } from '../lib/utils'
import { ClipboardList, Search, Filter, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const ACTION_COLORS: Record<string, { color: string; bg: string }> = {
  upload:   { color: 'text-green-400',  bg: 'bg-green-900/30' },
  download: { color: 'text-brand-400',  bg: 'bg-brand-900/30' },
  delete:   { color: 'text-red-400',    bg: 'bg-red-900/30' },
  grant:    { color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  revoke:   { color: 'text-orange-400', bg: 'bg-orange-900/30' },
  denied:   { color: 'text-red-500',    bg: 'bg-red-950/50' },
  login:    { color: 'text-gray-400',   bg: 'bg-gray-800/30' },
}

export default function AuditPage() {
  const { profile } = useAuthStore()
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs-full'],
    queryFn: () => fetchAuditLogs({ limit: 500 }),
  })

  const filtered = logs.filter(log => {
    if (actionFilter && log.action !== actionFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        log.action.includes(q) ||
        log.resource_type?.includes(q) ||
        log.resource_id?.includes(q) ||
        log.actor_id?.includes(q)
      )
    }
    return true
  })

  const uniqueActions = [...new Set(logs.map(l => l.action))]

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-brand-400" />
          Audit Log
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {profile?.role === 'administrator'
            ? 'All system events — append-only, tamper-evident'
            : 'Your account events'}
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 mb-5 flex-wrap">
        <div className="card px-4 py-3 flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <div>
            <p className="text-xl font-bold text-white">{logs.filter(l => l.action !== 'denied').length}</p>
            <p className="text-xs text-gray-400">Successful events</p>
          </div>
        </div>
        <div className="card px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <div>
            <p className="text-xl font-bold text-white">{logs.filter(l => l.action === 'denied').length}</p>
            <p className="text-xs text-gray-400">Denied access attempts</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            id="audit-search"
            type="search"
            placeholder="Search events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select
            id="action-filter"
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="input pl-9 pr-8 w-40"
          >
            <option value="">All actions</option>
            {uniqueActions.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No audit events found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-700 border-b border-surface-600">
                <tr>
                  <th className="table-header">Action</th>
                  <th className="table-header hidden sm:table-cell">Resource</th>
                  <th className="table-header hidden md:table-cell">Actor</th>
                  <th className="table-header">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700">
                {filtered.map(log => {
                  const style = ACTION_COLORS[log.action] ?? { color: 'text-gray-400', bg: 'bg-gray-800/20' }
                  return (
                    <tr key={log.id} className="hover:bg-surface-700/50 transition-colors">
                      <td className="table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono ${style.color} ${style.bg}`}>
                          {log.action.toUpperCase()}
                        </span>
                      </td>
                      <td className="table-cell hidden sm:table-cell">
                        {log.resource_type && (
                          <div>
                            <span className="text-xs text-gray-400">{log.resource_type}</span>
                            {log.resource_id && (
                              <p className="text-xs text-gray-600 font-mono truncate max-w-[140px]">
                                {log.resource_id}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="table-cell hidden md:table-cell">
                        <span className="text-xs text-gray-500 font-mono truncate max-w-[120px] block">
                          {log.actor_id ? log.actor_id.slice(0, 8) + '...' : 'system'}
                        </span>
                      </td>
                      <td className="table-cell text-gray-400 whitespace-nowrap text-xs">
                        {formatDateTime(log.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
        <AlertCircle className="w-3 h-3" />
        Audit logs are append-only and cannot be modified or deleted by any user.
      </div>
    </div>
  )
}
