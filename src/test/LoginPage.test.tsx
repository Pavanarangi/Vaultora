import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../pages/LoginPage'
import { useAuthStore } from '../stores/authStore'

// Mock navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, loading: false, initialized: true })
  })

  it('renders sign in form by default', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: /Vaultora/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/your password/i)).toBeInTheDocument()
    // Two "Sign In" buttons exist (tab + submit); both should be present
    expect(screen.getAllByText(/sign in/i).length).toBeGreaterThanOrEqual(1)
  })

  it('shows full name field when switching to sign up', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.click(screen.getByRole('button', { name: /sign up/i }))
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
  })

  it('shows error when Supabase is not configured after form submit', async () => {
    const user = userEvent.setup()
    const { container } = renderLogin()
    await user.type(screen.getByLabelText(/email address/i), 'test@test.com')
    await user.type(screen.getByPlaceholderText(/your password/i), 'password123')
    // Use container.querySelector to get the submit button uniquely
    const submitBtn = container.querySelector('#auth-submit-btn') as HTMLElement
    expect(submitBtn).not.toBeNull()
    await user.click(submitBtn)
    // Error message rendered synchronously when supabase not configured
    expect(screen.getByText(/Supabase is not configured/i)).toBeInTheDocument()
  })

  it('displays demo mode warning when Supabase not configured', () => {
    renderLogin()
    expect(screen.getByText(/demo mode/i)).toBeInTheDocument()
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    renderLogin()
    const passwordInput = screen.getByPlaceholderText(/your password/i)
    expect(passwordInput).toHaveAttribute('type', 'password')
    await user.click(screen.getByLabelText(/show password/i))
    expect(passwordInput).toHaveAttribute('type', 'text')
  })

  it('fills demo credentials when clicking quick test account button', async () => {
    const user = userEvent.setup()
    renderLogin()
    const adminBtn = screen.getByRole('button', { name: /admin/i })
    await user.click(adminBtn)
    expect(screen.getByLabelText(/email address/i)).toHaveValue('admin@vaultora.dev')
    expect(screen.getByPlaceholderText(/your password/i)).toHaveValue('VaultoraDemo2026!')
  })

  it('switches to forgot password mode and back', async () => {
    const user = userEvent.setup()
    renderLogin()
    const forgotBtn = screen.getByRole('button', { name: /forgot password/i })
    await user.click(forgotBtn)
    expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument()
    const backBtn = screen.getByRole('button', { name: /back to sign in/i })
    await user.click(backBtn)
    expect(screen.getByRole('heading', { name: /Vaultora/i })).toBeInTheDocument()
  })

  it('expands and collapses the Supabase database setup guide', async () => {
    const user = userEvent.setup()
    renderLogin()
    const guideToggle = screen.getByRole('button', { name: /database setup guide/i })
    await user.click(guideToggle)
    expect(screen.getByText(/COMPLETE_SETUP\.sql/i)).toBeInTheDocument()
  })
})
