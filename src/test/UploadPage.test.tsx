import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UploadPage from '../pages/UploadPage'
import { renderWithProviders } from './test-utils'
import { useAuthStore } from '../stores/authStore'
import * as api from '../lib/api'

vi.mock('../lib/api')

describe('UploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      profile: {
        id: 'user-1',
        email: 'alice@trustvault.dev',
        full_name: 'Alice Cooper',
        role: 'owner',
        avatar_url: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      user: { id: 'user-1', email: 'alice@trustvault.dev' } as any,
      loading: false,
      initialized: true,
    })
  })

  it('renders upload page elements', () => {
    renderWithProviders(<UploadPage />)
    expect(screen.getByRole('heading', { name: /Upload Document/i })).toBeInTheDocument()
    expect(screen.getByText(/Drop a file or click to browse/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Tags/i)).toBeInTheDocument()
  })

  it('validates required fields before submitting', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UploadPage />)

    const uploadBtn = screen.getByRole('button', { name: /Upload Document/i })
    await user.click(uploadBtn)

    expect(api.uploadDocument).not.toHaveBeenCalled()
  })
})
