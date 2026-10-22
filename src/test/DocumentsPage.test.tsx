import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentsPage from '../pages/DocumentsPage'
import { renderWithProviders } from './test-utils'
import { useAuthStore } from '../stores/authStore'
import * as api from '../lib/api'
import type { Document, Profile } from '../types/database'

vi.mock('../lib/api')

const mockOwner: Profile = {
  id: 'user-1',
  email: 'alice@trustvault.dev',
  full_name: 'Alice Cooper',
  role: 'owner',
  avatar_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockDocs: Document[] = [
  {
    id: 'doc-1',
    owner_id: 'user-1',
    title: 'Financial Q4 Statement',
    description: 'Q4 summary',
    file_path: 'user-1/doc-1/q4.pdf',
    file_name: 'q4.pdf',
    file_size: 512000,
    mime_type: 'application/pdf',
    version: 1,
    tags: ['finance'],
    created_at: '2026-10-15T10:00:00Z',
    updated_at: '2026-10-15T10:00:00Z',
  },
  {
    id: 'doc-2',
    owner_id: 'user-1',
    title: 'Employee Handbook',
    description: 'Policies',
    file_path: 'user-1/doc-2/handbook.docx',
    file_name: 'handbook.docx',
    file_size: 1024000,
    mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    version: 1,
    tags: ['hr'],
    created_at: '2026-10-16T10:00:00Z',
    updated_at: '2026-10-16T10:00:00Z',
  },
]

describe('DocumentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      profile: mockOwner,
      user: { id: 'user-1', email: 'alice@trustvault.dev' } as any,
      loading: false,
      initialized: true,
    })

    vi.mocked(api.fetchMyDocuments).mockResolvedValue(mockDocs)
  })

  it('renders document library heading and documents', async () => {
    renderWithProviders(<DocumentsPage />)
    expect(await screen.findByRole('heading', { name: /Document Library/i })).toBeInTheDocument()
    expect(await screen.findByText('Financial Q4 Statement')).toBeInTheDocument()
    expect(screen.getByText('Employee Handbook')).toBeInTheDocument()
  })

  it('filters documents when searching', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DocumentsPage />)

    const searchInput = await screen.findByPlaceholderText(/Search documents/i)
    await user.type(searchInput, 'Handbook')

    expect(screen.getByText('Employee Handbook')).toBeInTheDocument()
    expect(screen.queryByText('Financial Q4 Statement')).not.toBeInTheDocument()
  })
})
