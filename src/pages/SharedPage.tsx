import { useQuery } from '@tanstack/react-query'
import { fetchSharedWithMe } from '../lib/api'
import { formatFileSize, formatRelativeTime, getMimeIcon } from '../lib/utils'
import { Share2, Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function SharedPage() {
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['shared-docs'],
    queryFn: fetchSharedWithMe,
  })

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Shared with Me</h1>
        <p className="text-gray-400 text-sm mt-0.5">Documents others have granted you access to</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : docs.length === 0 ? (
        <div className="card text-center py-16">
          <Share2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No documents shared with you yet</p>
          <p className="text-gray-500 text-sm mt-1">Ask a document owner to grant you access</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-700 border-b border-surface-600">
              <tr>
                <th className="table-header">Document</th>
                <th className="table-header hidden md:table-cell">Size</th>
                <th className="table-header">Modified</th>
                <th className="table-header text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {docs.map(doc => (
                <tr key={doc.id} className="hover:bg-surface-700/50 transition-colors group">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getMimeIcon(doc.mime_type)}</span>
                      <div>
                        <p className="font-medium text-gray-200">{doc.title}</p>
                        <p className="text-xs text-gray-500">{doc.file_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell hidden md:table-cell text-gray-400">
                    {formatFileSize(doc.file_size)}
                  </td>
                  <td className="table-cell text-gray-400">
                    {formatRelativeTime(doc.updated_at)}
                  </td>
                  <td className="table-cell text-right">
                    <Link
                      to={`/documents/${doc.id}`}
                      className="btn-ghost text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      id={`view-shared-${doc.id}`}
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
