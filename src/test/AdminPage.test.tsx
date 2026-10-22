import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import AdminPage from '../pages/AdminPage'
import { renderWithProviders } from './test-utils'
import { useAuthStore } from '../stores/authStore'
import * as api from '../lib/api'
import type { Profile } from '../types/database'

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

const mockUsers: Profile[] = [
  mockAdminProfile,
  {
    id: 'user-2',
    email: 'alice@trustvault.dev',
    full_name: 'Alice Cooper',
    role: 'owner',
    avatar_url: null,
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 'user-3',
    email: 'bob@trustvault.dev',
    full_name: 'Bob Viewer',
    role: 'viewer',
    avatar_url: null,
    created_at: '2026-01-03T00:00:00Z',
    updated_at: '2026-01-03T00:00:00Z',
  },
]

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      profile: mockAdminProfile,
      user: { id: 'admin-1', email: 'admin@trustvault.dev' } as any,
      loading: false,
      initialized: true,
    })

    vi.mocked(api.fetchAllProfiles).mockResolvedValue(mockUsers)
  })

  it('renders admin dashboard heading and stats', async () => {
    renderWithProviders(<AdminPage />)
    expect(await screen.findByRole('heading', { name: /Admin Dashboard/i })).toBeInTheDocument()
    expect(await screen.findByText('Total Users')).toBeInTheDocument()
    expect(await screen.findByText('Administrators')).toBeInTheDocument()
    expect(await screen.findByText('Owners')).toBeInTheDocument()
  })

  it('renders user management table with all users', async () => {
    renderWithProviders(<AdminPage />)
    expect(await screen.findByText('admin@trustvault.dev')).toBeInTheDocument()
    expect(await screen.findByText('alice@trustvault.dev')).toBeInTheDocument()
    expect(await screen.findByText('bob@trustvault.dev')).toBeInTheDocument()
  })
})
