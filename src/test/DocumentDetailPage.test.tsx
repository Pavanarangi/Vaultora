import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import DocumentDetailPage from '../pages/DocumentDetailPage'
import { renderWithProviders } from './test-utils'
import { useAuthStore } from '../stores/authStore'
import * as api from '../lib/api'
import type { Document, Profile } from '../types/database'

vi.mock('../lib/api')

const mockOwnerProfile: Profile = {
  id: 'user-1',
  email: 'alice@trustvault.dev',
  full_name: 'Alice Cooper',
  role: 'owner',
  avatar_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockDoc: Document = {
  id: 'doc-123',
  owner_id: 'user-1',
  title: 'Architecture Blueprint',
  description: 'Detailed system diagram and spec',
  file_path: 'user-1/doc-123/arch.pdf',
  file_name: 'arch.pdf',
  file_size: 2048,
  mime_type: 'application/pdf',
  version: 1,
  tags: ['architecture', 'spec'],
  created_at: '2026-10-22T08:00:00Z',
  updated_at: '2026-10-22T08:00:00Z',
}

describe('DocumentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      profile: mockOwnerProfile,
      user: { id: 'user-1', email: 'alice@trustvault.dev' } as any,
      loading: false,
      initialized: true,
    })

    vi.mocked(api.fetchDocument).mockResolvedValue(mockDoc)
    vi.mocked(api.fetchDocumentGrants).mockResolvedValue([
      {
        id: 'grant-1',
        document_id: 'doc-123',
        granted_to: 'user-2',
        granted_by: 'user-1',
        permission: 'read',
        created_at: '2026-10-22T09:00:00Z',
        expires_at: null,
        recipient_email: 'bob@trustvault.dev',
        recipient_name: 'Bob Viewer',
      },
    ])
    vi.mocked(api.fetchAuditLogs).mockResolvedValue([])
  })

  it('renders document title and file details', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/documents/:id" element={<DocumentDetailPage />} />
      </Routes>,
      { initialEntries: ['/documents/doc-123'] }
    )
    expect(await screen.findByText('Architecture Blueprint')).toBeInTheDocument()
    expect(screen.getByText('arch.pdf')).toBeInTheDocument()
    expect(screen.getByText('Detailed system diagram and spec')).toBeInTheDocument()
  })

  it('renders download and edit buttons for owner', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/documents/:id" element={<DocumentDetailPage />} />
      </Routes>,
      { initialEntries: ['/documents/doc-123'] }
    )
    expect(await screen.findByRole('button', { name: /Download/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument()
  })

  it('renders grant access section and recipient email', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/documents/:id" element={<DocumentDetailPage />} />
      </Routes>,
      { initialEntries: ['/documents/doc-123'] }
    )
    expect(await screen.findByText('Access Control')).toBeInTheDocument()
    expect(await screen.findByText('bob@trustvault.dev')).toBeInTheDocument()
    expect(screen.getByText('Bob Viewer')).toBeInTheDocument()
  })
})
