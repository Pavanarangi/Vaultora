import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import { fetchMyDocuments, fetchAuditLogs, fetchSharedWithMe } from '../lib/api'
import { formatRelativeTime, formatFileSize, getMimeIcon } from '../lib/utils'
import { FileText, Upload, Share2, Shield, TrendingUp, Clock, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function DashboardPage() {
  const { profile } = useAuthStore()

  const { data: myDocs = [], isLoading: docsLoading } = useQuery({
    queryKey: ['my-documents'],
    queryFn: fetchMyDocuments,
  })

  const { data: sharedDocs = [] } = useQuery({
    queryKey: ['shared-docs'],
    queryFn: fetchSharedWithMe,
  })

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs', { limit: 10 }],
    queryFn: () => fetchAuditLogs({ limit: 10 }),
  })

  const totalSize = myDocs.reduce((acc, d) => acc + d.file_size, 0)

  const stats = [
    {
      label: 'My Documents',
      value: myDocs.length,
      icon: FileText,
      color: 'text-brand-400',
      bg: 'bg-brand-600/10',
      link: '/documents',
    },
    {
      label: 'Shared with Me',
      value: sharedDocs.length,
      icon: Share2,
      color: 'text-green-400',
      bg: 'bg-green-600/10',
      link: '/shared',
    },
    {
      label: 'Storage Used',
      value: formatFileSize(totalSize),
      icon: TrendingUp,
      color: 'text-purple-400',
      bg: 'bg-purple-600/10',
    },
    {
      label: 'Recent Events',
      value: auditLogs.length,
      icon: Shield,
      color: 'text-yellow-400',
      bg: 'bg-yellow-600/10',
      link: '/audit',
    },
  ]

  const actionColors: Record<string, string> = {
    upload: 'text-green-400',
    download: 'text-brand-400',
    delete: 'text-red-400',
    grant: 'text-yellow-400',
    revoke: 'text-orange-400',
    denied: 'text-red-500',
    login: 'text-gray-400',
  }

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">
          Welcome back, {profile?.full_name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-gray-400 text-sm">
          Here's what's happening in your vault today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg, link }) => (
          <div key={label} className="stat-card">
            <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{docsLoading ? '—' : value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
            {link && (
              <Link to={link} className="ml-auto text-gray-600 hover:text-brand-400 transition-colors text-xs">
                View →
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Documents */}
        <div className="card">
          <div className="p-5 border-b border-surface-600 flex items-center justify-between">
            <div>
              <h2 className="section-title">Recent Documents</h2>
              <p className="section-subtitle">Your latest uploads and edits</p>
            </div>
            <Link to="/documents/upload" className="btn-primary text-sm py-1.5 px-3">
              <Upload className="w-3.5 h-3.5" /> Upload
            </Link>
          </div>
          <div className="p-2">
            {docsLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : myDocs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No documents yet.</p>
                <Link to="/documents/upload" className="text-brand-400 hover:text-brand-300 mt-1 inline-block">
                  Upload your first document →
                </Link>
              </div>
            ) : (
              myDocs.slice(0, 5).map(doc => (
                <Link
                  key={doc.id}
                  to={`/documents/${doc.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-700 transition-colors group"
                >
                  <span className="text-2xl">{getMimeIcon(doc.mime_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white">
                      {doc.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(doc.file_size)} · {formatRelativeTime(doc.updated_at)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
          {myDocs.length > 5 && (
            <div className="p-3 border-t border-surface-600 text-center">
              <Link to="/documents" className="text-sm text-brand-400 hover:text-brand-300">
                View all {myDocs.length} documents →
              </Link>
            </div>
          )}
        </div>

        {/* Recent Audit Activity */}
        <div className="card">
          <div className="p-5 border-b border-surface-600 flex items-center justify-between">
            <div>
              <h2 className="section-title">Recent Activity</h2>
              <p className="section-subtitle">Security and access events</p>
            </div>
            <Link to="/audit" className="text-sm text-brand-400 hover:text-brand-300">
              View all →
            </Link>
          </div>
          <div className="p-2">
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No activity yet.</p>
              </div>
            ) : (
              auditLogs.slice(0, 8).map(log => (
                <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-700 transition-colors">
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                    log.action === 'denied' ? 'bg-red-500' :
                    log.action === 'upload' ? 'bg-green-500' :
                    log.action === 'download' ? 'bg-brand-500' : 'bg-gray-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300">
                      <span className={`font-medium ${actionColors[log.action] ?? 'text-gray-300'}`}>
                        {log.action.toUpperCase()}
                      </span>
                      {log.resource_type && (
                        <span className="text-gray-500"> · {log.resource_type}</span>
                      )}
                    </p>
                    {log.action === 'denied' && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <AlertCircle className="w-3 h-3 text-red-400" />
                        <span className="text-xs text-red-400">Access denied</span>
                      </div>
                    )}
                    <p className="text-xs text-gray-600">{formatRelativeTime(log.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
