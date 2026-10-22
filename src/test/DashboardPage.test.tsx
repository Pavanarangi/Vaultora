import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import DashboardPage from '../pages/DashboardPage'
import { renderWithProviders } from './test-utils'
import { useAuthStore } from '../stores/authStore'
import * as api from '../lib/api'
import type { Document, AuditLog, Profile } from '../types/database'

vi.mock('../lib/api')

const mockProfile: Profile = {
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
    title: 'Financial Q4 Report',
    description: 'Q4 report details',
    file_path: 'user-1/doc-1/report.pdf',
    file_name: 'report.pdf',
    file_size: 1024 * 1024,
    mime_type: 'application/pdf',
    version: 1,
    tags: ['finance'],
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
  },
]

const mockAuditLogs: AuditLog[] = [
  {
    id: 'log-1',
    actor_id: 'user-1',
    action: 'upload',
    resource_type: 'document',
    resource_id: 'doc-1',
    metadata: { file_name: 'report.pdf' },
    ip_address: null,
    created_at: '2026-10-20T10:00:00Z',
  },
]

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      profile: mockProfile,
      user: { id: 'user-1', email: 'alice@trustvault.dev' } as any,
      loading: false,
      initialized: true,
    })

    vi.mocked(api.fetchMyDocuments).mockResolvedValue(mockDocs)
    vi.mocked(api.fetchSharedWithMe).mockResolvedValue([])
    vi.mocked(api.fetchAuditLogs).mockResolvedValue(mockAuditLogs)
  })

  it('renders greeting with user first name', async () => {
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByText(/Welcome back, Alice/i)).toBeInTheDocument()
  })

  it('renders stats cards correctly', async () => {
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByText('My Documents')).toBeInTheDocument()
    expect(await screen.findByText('Shared with Me')).toBeInTheDocument()
    expect(await screen.findByText('Storage Used')).toBeInTheDocument()
    expect(await screen.findByText('Recent Events')).toBeInTheDocument()
  })

  it('renders recent documents table', async () => {
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByText('Financial Q4 Report')).toBeInTheDocument()
  })
})
