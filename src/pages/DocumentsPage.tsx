import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchMyDocuments, deleteDocument } from '../lib/api'
import { formatFileSize, formatRelativeTime, getMimeIcon, getMimeColor } from '../lib/utils'
import { Search, Upload, Trash2, Eye, Filter, SortAsc, SortDesc } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

type SortField = 'title' | 'updated_at' | 'file_size' | 'created_at'
type SortDir = 'asc' | 'desc'

export default function DocumentsPage() {
  const { profile } = useAuthStore()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [mimeFilter, setMimeFilter] = useState('')
  const [sortField, setSortField] = useState<SortField>('updated_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [deleting, setDeleting] = useState<string | null>(null)

  const { data: documents = [], isLoading, error } = useQuery({
    queryKey: ['my-documents'],
    queryFn: fetchMyDocuments,
  })

  const mimeCategories = useMemo(() => {
    const cats = new Set<string>()
    documents.forEach(d => {
      const cat = d.mime_type.split('/')[0]
      cats.add(cat)
    })
    return Array.from(cats)
  }, [documents])

  const filtered = useMemo(() => {
    let result = documents

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.file_name.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.tags?.some(t => t.toLowerCase().includes(q))
      )
    }

    if (mimeFilter) {
      result = result.filter(d => d.mime_type.startsWith(mimeFilter))
    }

    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortField === 'title') cmp = a.title.localeCompare(b.title)
      else if (sortField === 'file_size') cmp = a.file_size - b.file_size
      else cmp = new Date(a[sortField]).getTime() - new Date(b[sortField]).getTime()
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [documents, search, mimeFilter, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await deleteDocument(id)
      queryClient.invalidateQueries({ queryKey: ['my-documents'] })
      toast.success('Document deleted')
    } catch {
      toast.error('Failed to delete document')
    } finally {
      setDeleting(null)
    }
  }

  const canDelete = (ownerId: string) =>
    profile?.id === ownerId || profile?.role === 'administrator'

  if (error) {
    return (
      <div className="p-6 text-center text-red-400">
        Failed to load documents. Make sure Supabase is configured.
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Document Library</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {documents.length} document{documents.length !== 1 ? 's' : ''} in your vault
          </p>
        </div>
        <Link to="/documents/upload" className="btn-primary">
          <Upload className="w-4 h-4" />
          Upload Document
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            id="doc-search"
            type="search"
            placeholder="Search documents, tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select
            id="mime-filter"
            value={mimeFilter}
            onChange={e => setMimeFilter(e.target.value)}
            className="input pl-9 pr-8 w-44"
          >
            <option value="">All types</option>
            {mimeCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
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
            <Upload className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-gray-400">
              {search || mimeFilter ? 'No documents match your filters.' : 'Your vault is empty.'}
            </p>
            {!search && !mimeFilter && (
              <Link to="/documents/upload" className="text-brand-400 hover:text-brand-300 text-sm mt-2 inline-block">
                Upload your first document →
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-700 border-b border-surface-600">
              <tr>
                <th className="table-header">
                  <button onClick={() => toggleSort('title')} className="flex items-center gap-1 hover:text-gray-200">
                    Name {sortField === 'title' ? (sortDir === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />) : null}
                  </button>
                </th>
                <th className="table-header hidden md:table-cell">Type</th>
                <th className="table-header hidden sm:table-cell">
                  <button onClick={() => toggleSort('file_size')} className="flex items-center gap-1 hover:text-gray-200">
                    Size {sortField === 'file_size' ? (sortDir === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />) : null}
                  </button>
                </th>
                <th className="table-header">
                  <button onClick={() => toggleSort('updated_at')} className="flex items-center gap-1 hover:text-gray-200">
                    Modified {sortField === 'updated_at' ? (sortDir === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />) : null}
                  </button>
                </th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {filtered.map(doc => (
                <tr key={doc.id} className="hover:bg-surface-700/50 transition-colors group">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <span className={`text-xl ${getMimeColor(doc.mime_type)}`}>
                        {getMimeIcon(doc.mime_type)}
                      </span>
                      <div className="min-w-0">
                        <Link
                          to={`/documents/${doc.id}`}
                          className="font-medium text-gray-200 hover:text-white block truncate max-w-xs"
                        >
                          {doc.title}
                        </Link>
                        <p className="text-xs text-gray-500 truncate">{doc.file_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell hidden md:table-cell">
                    <span className="text-xs text-gray-500 font-mono">{doc.mime_type.split('/')[1]}</span>
                  </td>
                  <td className="table-cell hidden sm:table-cell text-gray-400">
                    {formatFileSize(doc.file_size)}
                  </td>
                  <td className="table-cell text-gray-400">
                    {formatRelativeTime(doc.updated_at)}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Link
                        to={`/documents/${doc.id}`}
                        className="btn-ghost p-1.5"
                        title="View document"
                        id={`view-doc-${doc.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      {canDelete(doc.owner_id) && (
                        <button
                          onClick={() => handleDelete(doc.id, doc.title)}
                          disabled={deleting === doc.id}
                          className="btn-ghost p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          title="Delete document"
                          id={`delete-doc-${doc.id}`}
                        >
                          {deleting === doc.id ? <LoadingSpinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-600 mt-3 text-right">
        Showing {filtered.length} of {documents.length} documents
      </p>
    </div>
  )
}
