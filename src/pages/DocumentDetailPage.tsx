import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchDocument,
  fetchDocumentGrants,
  updateDocumentMetadata,
  deleteDocument,
  getDownloadUrl,
  grantAccess,
  revokeAccess,
  fetchAuditLogs,
} from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import {
  formatFileSize,
  formatDateTime,
  formatRelativeTime,
  getMimeIcon,
} from '../lib/utils'
import {
  ChevronLeft,
  Download,
  Trash2,
  Edit3,
  Save,
  X,
  UserPlus,
  UserMinus,
  Shield,
  Clock,
  Tag,
  AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { cn } from '../lib/utils'

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile } = useAuthStore()

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editTags, setEditTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Grant form
  const [grantEmail, setGrantEmail] = useState('')
  const [grantPermission, setGrantPermission] = useState<'read' | 'edit'>('read')
  const [granting, setGranting] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ['document', id],
    queryFn: () => fetchDocument(id!),
    enabled: !!id,
  })

  const { data: grants = [] } = useQuery({
    queryKey: ['grants', id],
    queryFn: () => fetchDocumentGrants(id!),
    enabled: !!id,
  })

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['doc-audit', id],
    queryFn: () => fetchAuditLogs({ resourceId: id, limit: 20 }),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-gray-400">Document not found or you don't have access.</p>
        <Link to="/documents" className="text-brand-400 hover:text-brand-300 text-sm mt-2 inline-block">
          ← Back to Documents
        </Link>
      </div>
    )
  }

  const isOwner = profile?.id === doc.owner_id
  const isAdmin = profile?.role === 'administrator'
  const canManage = isOwner || isAdmin
  const hasEditGrant = grants.some(g => g.granted_to === profile?.id && g.permission === 'edit')
  const canEdit = canManage || hasEditGrant

  const startEdit = () => {
    setEditTitle(doc.title)
    setEditDesc(doc.description ?? '')
    setEditTags(doc.tags?.join(', ') ?? '')
    setEditing(true)
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await updateDocumentMetadata(id!, {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
      })
      queryClient.invalidateQueries({ queryKey: ['document', id] })
      queryClient.invalidateQueries({ queryKey: ['my-documents'] })
      toast.success('Document updated')
      setEditing(false)
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const url = await getDownloadUrl(id!)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      toast.success('Download started')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed'
      toast.error(msg)
    } finally {
      setDownloading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteDocument(id!)
      queryClient.invalidateQueries({ queryKey: ['my-documents'] })
      toast.success('Document deleted')
      navigate('/documents')
    } catch {
      toast.error('Failed to delete')
      setDeleting(false)
    }
  }

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!grantEmail.trim()) return
    setGranting(true)
    try {
      await grantAccess(id!, grantEmail.trim(), grantPermission)
      queryClient.invalidateQueries({ queryKey: ['grants', id] })
      toast.success(`Access granted to ${grantEmail}`)
      setGrantEmail('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to grant access'
      toast.error(msg)
    } finally {
      setGranting(false)
    }
  }

  const handleRevoke = async (grantId: string, email?: string) => {
    if (!confirm(`Revoke access${email ? ` for ${email}` : ''}?`)) return
    setRevoking(grantId)
    try {
      await revokeAccess(grantId)
      queryClient.invalidateQueries({ queryKey: ['grants', id] })
      toast.success('Access revoked')
    } catch {
      toast.error('Failed to revoke access')
    } finally {
      setRevoking(null)
    }
  }

  const actionColors: Record<string, string> = {
    upload: 'text-green-400',
    download: 'text-brand-400',
    delete: 'text-red-400',
    grant: 'text-yellow-400',
    revoke: 'text-orange-400',
    denied: 'text-red-500',
  }

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="btn-ghost mb-5 -ml-2" id="back-btn">
        <ChevronLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div className="card p-6 mb-5">
        <div className="flex items-start gap-4">
          <div className="text-5xl">{getMimeIcon(doc.mime_type)}</div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                id="edit-title"
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="input text-xl font-bold mb-2"
                autoFocus
              />
            ) : (
              <h1 className="text-xl font-bold text-white mb-1 break-words">{doc.title}</h1>
            )}

            <p className="text-sm text-gray-500">{doc.file_name}</p>

            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-400">
              <span>{formatFileSize(doc.file_size)}</span>
              <span>·</span>
              <span className="font-mono">{doc.mime_type}</span>
              <span>·</span>
              <span>v{doc.version}</span>
              <span>·</span>
              <span>Modified {formatRelativeTime(doc.updated_at)}</span>
            </div>

            {editing ? (
              <textarea
                id="edit-description"
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                placeholder="Description..."
                rows={2}
                className="input mt-3 resize-none text-sm"
              />
            ) : doc.description ? (
              <p className="text-sm text-gray-400 mt-3">{doc.description}</p>
            ) : null}

            {editing ? (
              <input
                id="edit-tags"
                type="text"
                value={editTags}
                onChange={e => setEditTags(e.target.value)}
                placeholder="Tags (comma-separated)"
                className="input mt-2 text-sm"
              />
            ) : doc.tags && doc.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {doc.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-surface-600 rounded text-xs text-gray-400">
                    <Tag className="w-3 h-3" />{tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="btn-primary text-sm"
              id="download-btn"
            >
              {downloading ? <LoadingSpinner size="sm" /> : <Download className="w-4 h-4" />}
              Download
            </button>

            {canEdit && !editing && (
              <button onClick={startEdit} className="btn-secondary text-sm" id="edit-btn">
                <Edit3 className="w-4 h-4" /> Edit
              </button>
            )}

            {editing && (
              <>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="btn-primary text-sm"
                  id="save-edit-btn"
                >
                  {saving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="btn-ghost text-sm"
                  id="cancel-edit-btn"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
              </>
            )}

            {canManage && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-danger text-sm"
                id="delete-doc-btn"
              >
                {deleting ? <LoadingSpinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Permission Management */}
        {canManage && (
          <div className="card">
            <div className="p-4 border-b border-surface-600">
              <h2 className="section-title flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-400" /> Access Control
              </h2>
              <p className="section-subtitle">Grant or revoke access to this document</p>
            </div>

            {/* Grant form */}
            <form onSubmit={handleGrant} className="p-4 border-b border-surface-600 space-y-3">
              <div>
                <label htmlFor="grant-email" className="label text-xs">User Email</label>
                <input
                  id="grant-email"
                  type="email"
                  value={grantEmail}
                  onChange={e => setGrantEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="input text-sm"
                  required
                />
              </div>
              <div className="flex gap-2">
                <select
                  id="grant-permission"
                  value={grantPermission}
                  onChange={e => setGrantPermission(e.target.value as 'read' | 'edit')}
                  className="input text-sm flex-1"
                >
                  <option value="read">Read only</option>
                  <option value="edit">Can edit</option>
                </select>
                <button
                  type="submit"
                  disabled={granting}
                  className="btn-primary text-sm px-3"
                  id="grant-access-btn"
                >
                  {granting ? <LoadingSpinner size="sm" /> : <UserPlus className="w-4 h-4" />}
                  Grant
                </button>
              </div>
            </form>

            {/* Current grants */}
            <div className="p-2">
              {grants.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-4">No grants yet</p>
              ) : (
                grants.map(grant => (
                  <div key={grant.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-700/50">
                    <div className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-xs font-semibold text-brand-300 shrink-0">
                      {(grant.recipient_name?.[0] ?? grant.recipient_email?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">
                        {grant.recipient_email ?? grant.granted_to}
                      </p>
                      {grant.recipient_name && (
                        <p className="text-xs text-gray-400 truncate -mt-0.5">{grant.recipient_name}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn(
                          grant.permission === 'edit' ? 'badge-edit' : 'badge-read'
                        )}>
                          {grant.permission}
                        </span>
                        {grant.expires_at && (
                          <span className="text-xs text-gray-500">
                            Expires {formatDateTime(grant.expires_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevoke(grant.id, grant.recipient_email ?? grant.granted_to)}
                      disabled={revoking === grant.id}
                      className="btn-ghost p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      id={`revoke-${grant.id}`}
                      title="Revoke access"
                    >
                      {revoking === grant.id ? <LoadingSpinner size="sm" /> : <UserMinus className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Audit Log */}
        <div className="card">
          <div className="p-4 border-b border-surface-600">
            <h2 className="section-title flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-400" /> Activity History
            </h2>
            <p className="section-subtitle">All access events for this document</p>
          </div>
          <div className="p-2 max-h-72 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-4">No activity recorded</p>
            ) : (
              auditLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-surface-700/50">
                  <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                    log.action === 'denied' ? 'bg-red-500' :
                    log.action === 'upload' ? 'bg-green-500' :
                    log.action === 'download' ? 'bg-brand-500' : 'bg-gray-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-semibold ${actionColors[log.action] ?? 'text-gray-400'}`}>
                      {log.action.toUpperCase()}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatRelativeTime(log.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Document Info */}
        <div className="card lg:col-span-2">
          <div className="p-4 border-b border-surface-600">
            <h2 className="section-title">Document Information</h2>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { label: 'Created', value: formatDateTime(doc.created_at) },
              { label: 'Modified', value: formatDateTime(doc.updated_at) },
              { label: 'File Size', value: formatFileSize(doc.file_size) },
              { label: 'Version', value: `v${doc.version}` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-gray-300 font-medium">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
