import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import AuditPage from '../pages/AuditPage'
import { renderWithProviders } from './test-utils'
import { useAuthStore } from '../stores/authStore'
import * as api from '../lib/api'
import type { AuditLog, Profile } from '../types/database'

vi.mock('../lib/api')

const mockAdminProfile: Profile = {
  id: 'admin-1',
  email: 'admin@trustvault.dev',
  full_name: 'Admin User',
  role: 'administrator',
  avatar_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockLogs: AuditLog[] = [
  {
    id: 'log-1',
    actor_id: 'admin-1',
    action: 'upload',
    resource_type: 'document',
    resource_id: 'doc-1',
    metadata: { file_name: 'test.pdf' },
    ip_address: '127.0.0.1',
    created_at: '2026-10-22T10:00:00Z',
  },
  {
    id: 'log-2',
    actor_id: 'user-2',
    action: 'denied',
    resource_type: 'document',
    resource_id: 'doc-2',
    metadata: { reason: 'No grant' },
    ip_address: '127.0.0.1',
    created_at: '2026-10-22T10:05:00Z',
  },
]

describe('AuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      profile: mockAdminProfile,
      user: { id: 'admin-1', email: 'admin@trustvault.dev' } as any,
      loading: false,
      initialized: true,
    })

    vi.mocked(api.fetchAuditLogs).mockResolvedValue(mockLogs)
  })

  it('renders audit page heading and stats', async () => {
    renderWithProviders(<AuditPage />)
    expect(await screen.findByRole('heading', { name: /Audit Log/i })).toBeInTheDocument()
    expect(await screen.findByText('Successful events')).toBeInTheDocument()
    expect(await screen.findByText('Denied access attempts')).toBeInTheDocument()
  })

  it('renders search input and filter', async () => {
    renderWithProviders(<AuditPage />)
    expect(await screen.findByPlaceholderText(/Search events.../i)).toBeInTheDocument()
  })
})
