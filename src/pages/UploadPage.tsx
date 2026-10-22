import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { uploadDocument } from '../lib/api'
import { validateFile, formatFileSize, getMimeIcon, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_MB } from '../lib/utils'
import { Upload, X, File, AlertCircle, CheckCircle, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useQueryClient } from '@tanstack/react-query'

export default function UploadPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0]
    if (!f) return
    const err = validateFile(f)
    if (err) {
      setFileError(err)
      setFile(null)
      return
    }
    setFileError(null)
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''))
  }, [title])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: Object.fromEntries(ALLOWED_MIME_TYPES.map(t => [t, []])),
    maxSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { toast.error('Please select a file'); return }
    if (!title.trim()) { toast.error('Title is required'); return }

    setUploading(true)
    try {
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)

      const doc = await uploadDocument(file, {
        title: title.trim(),
        description: description.trim() || undefined,
        tags: tags.length ? tags : undefined,
      })

      queryClient.invalidateQueries({ queryKey: ['my-documents'] })
      toast.success('Document uploaded successfully!')
      navigate(`/documents/${doc.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="btn-ghost mb-6 -ml-2"
        id="back-btn"
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-2xl font-bold text-white mb-1">Upload Document</h1>
      <p className="text-gray-400 text-sm mb-6">
        Files are stored privately. Only you and people you grant access to can view them.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragActive
              ? 'border-brand-500 bg-brand-600/10'
              : file
              ? 'border-green-500 bg-green-900/10'
              : fileError
              ? 'border-red-500 bg-red-900/10'
              : 'border-surface-500 hover:border-brand-600/50 hover:bg-surface-700/30'
          }`}
          id="file-dropzone"
        >
          <input {...getInputProps()} id="file-input" />
          {file ? (
            <div className="flex flex-col items-center gap-3">
              <div className="text-4xl">{getMimeIcon(file.type)}</div>
              <div>
                <p className="font-medium text-gray-200">{file.name}</p>
                <p className="text-sm text-gray-400">{formatFileSize(file.size)}</p>
              </div>
              <div className="flex items-center gap-1 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Ready to upload</span>
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setFile(null); setFileError(null) }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" /> Remove
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-surface-600 flex items-center justify-center">
                {isDragActive ? (
                  <Upload className="w-6 h-6 text-brand-400 animate-bounce" />
                ) : (
                  <File className="w-6 h-6 text-gray-500" />
                )}
              </div>
              <div>
                <p className="font-medium text-gray-300">
                  {isDragActive ? 'Drop your file here' : 'Drop a file or click to browse'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  PDF, Word, Excel, PowerPoint, text, images · Max {MAX_FILE_SIZE_MB}MB
                </p>
              </div>
            </div>
          )}
        </div>

        {fileError && (
          <div className="flex items-start gap-2 text-red-400 text-sm bg-red-900/20 border border-red-700/30 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{fileError}</span>
          </div>
        )}

        {/* Metadata */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-200">Document Details</h2>

          <div>
            <label htmlFor="doc-title" className="label">Title <span className="text-red-400">*</span></label>
            <input
              id="doc-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Q4 Budget Report"
              required
              className="input"
              maxLength={200}
            />
          </div>

          <div>
            <label htmlFor="doc-description" className="label">Description</label>
            <textarea
              id="doc-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional: describe the document contents..."
              rows={3}
              className="input resize-none"
              maxLength={1000}
            />
          </div>

          <div>
            <label htmlFor="doc-tags" className="label">Tags</label>
            <input
              id="doc-tags"
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="finance, 2024, confidential (comma-separated)"
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">Separate tags with commas for better search and filtering</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading || !file}
            className="btn-primary flex-1 justify-center"
            id="upload-submit-btn"
          >
            {uploading ? (
              <><LoadingSpinner size="sm" /> Uploading...</>
            ) : (
              <><Upload className="w-4 h-4" /> Upload Document</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
