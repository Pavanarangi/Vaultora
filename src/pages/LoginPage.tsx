import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Mail,
  CheckCircle,
  RefreshCw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Database,
  Copy,
  Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/ui/LoadingSpinner'

type AuthMode = 'signin' | 'signup' | 'forgot' | 'confirm_pending'

interface ParsedAuthError {
  title: string
  message: string
  action?: 'signup' | 'signin' | 'resend' | 'schema'
}

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ParsedAuthError | null>(null)
  const [resending, setResending] = useState(false)
  const [showSetupGuide, setShowSetupGuide] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)

  const { user, initialize } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  const parseAuthError = (err: unknown): ParsedAuthError => {
    const rawMessage = err instanceof Error ? err.message : String(err)
    const lower = rawMessage.toLowerCase()

    if (lower.includes('rate limit') || lower.includes('over_email_send_rate_limit')) {
      return {
        title: 'Email Rate Limit Exceeded',
        message:
          'Supabase free tier limits confirmation emails to 3 per hour. To fix this permanently: In your Supabase Dashboard, go to Authentication -> Providers -> Email and turn off "Confirm email".',
        action: 'schema',
      }
    }

    if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) {
      return {
        title: 'Email Not Confirmed',
        message:
          'Please verify your email before logging in. Check your inbox and spam folder for the confirmation email from Supabase, or click below to resend it.',
        action: 'resend',
      }
    }

    if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
      return {
        title: 'Invalid Credentials',
        message:
          'The email or password does not match any existing account. If you are new to TrustVault, please switch to Sign Up.',
        action: 'signup',
      }
    }

    if (lower.includes('already registered') || lower.includes('already in use') || lower.includes('user_already_exists')) {
      return {
        title: 'Account Already Exists',
        message: 'An account with this email address already exists. Please sign in.',
        action: 'signin',
      }
    }

    if (lower.includes('database error') || lower.includes('schema cache') || lower.includes('pgrst205')) {
      return {
        title: 'Database Setup Required',
        message:
          'The "public.profiles" table does not exist in Supabase yet. Please execute the COMPLETE_SETUP.sql script in your Supabase SQL Editor.',
        action: 'schema',
      }
    }

    if (lower.includes('invalid') && lower.includes('email')) {
      return {
        title: 'Invalid Email Address',
        message: 'Please provide a valid, well-formed email address (e.g., user@company.com).',
      }
    }

    return {
      title: 'Authentication Error',
      message: rawMessage || 'An unexpected error occurred during authentication.',
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!isSupabaseConfigured) {
      setError({
        title: 'Configuration Required',
        message: 'Supabase is not configured. Please add credentials to .env.local.',
      })
      setLoading(false)
      return
    }

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
          },
        })

        if (signUpError) throw signUpError

        // If user is created but session is null, email confirmation is required
        if (data.user && !data.session) {
          setMode('confirm_pending')
          toast.success('Account created! Please check your email to confirm.')
        } else {
          await initialize()
          toast.success('Account created! Welcome to TrustVault.')
          navigate('/dashboard')
        }
      } else if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) throw signInError

        await initialize()
        toast.success('Welcome back to TrustVault!')
        navigate('/dashboard')
      } else if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/login`,
        })
        if (resetError) throw resetError

        toast.success('Password reset email sent. Check your inbox!')
        setMode('signin')
      }
    } catch (err: unknown) {
      setError(parseAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!email) {
      toast.error('Please enter your email address first.')
      return
    }
    setResending(true)
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      })
      if (resendError) throw resendError
      toast.success('Confirmation email resent. Please check your inbox.')
    } catch (err) {
      setError(parseAuthError(err))
    } finally {
      setResending(false)
    }
  }

  const handleCopySetupSql = async () => {
    const sqlText = `-- TrustVault Complete Setup: Execute in Supabase SQL Editor
-- File: supabase/COMPLETE_SETUP.sql in project root
-- 1. Creates profiles, documents, document_grants, audit_logs
-- 2. Sets up triggers and RLS policies
-- 3. Configures private "documents" storage bucket`
    try {
      await navigator.clipboard.writeText(sqlText)
      setCopiedSql(true)
      toast.success('SQL setup instructions copied to clipboard!')
      setTimeout(() => setCopiedSql(false), 3000)
    } catch {
      toast.error('Failed to copy. Please open supabase/COMPLETE_SETUP.sql')
    }
  }

  const fillQuickDemo = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword('TrustVaultDemo2026!')
    if (mode === 'signup') {
      setFullName(demoEmail.split('@')[0].toUpperCase())
    }
    setError(null)
  }

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 shadow-xl shadow-brand-600/30 mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gradient mb-1">TrustVault</h1>
          <p className="text-gray-400 text-sm">Secure enterprise document management</p>
        </div>

        {/* Card */}
        <div className="card p-8 animate-slide-up">
          {mode === 'confirm_pending' ? (
            /* Email Confirmation Pending Screen */
            <div className="text-center py-2 space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-500/10 text-blue-400 mb-2 border border-blue-500/20">
                <Mail className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-white">Check Your Inbox</h2>
              <p className="text-sm text-gray-300">
                We sent a confirmation link to <span className="font-semibold text-white">{email}</span>.
              </p>
              <div className="bg-surface-700/60 p-4 rounded-xl text-xs text-gray-300 text-left space-y-2 border border-surface-600">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  <span>Click the link in the email to activate your account.</span>
                </div>
                <div className="flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Developer Tip:</strong> You can disable email confirmation for instant signups in{' '}
                    <span className="text-brand-300">Supabase Dashboard &gt; Auth &gt; Providers &gt; Email &gt; Disable &quot;Confirm email&quot;</span>.
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={resending}
                  onClick={handleResendConfirmation}
                  className="btn-secondary w-full justify-center py-2.5 text-sm"
                >
                  {resending ? <LoadingSpinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
                  <span>Resend Confirmation Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin')
                    setError(null)
                  }}
                  className="btn-ghost w-full justify-center py-2 text-sm text-gray-400 hover:text-white"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mode toggle */}
              {mode !== 'forgot' && (
                <div className="flex rounded-lg bg-surface-700 p-1 mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin')
                      setError(null)
                    }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      mode === 'signin'
                        ? 'bg-brand-600 text-white shadow'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                    id="signin-tab"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup')
                      setError(null)
                    }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      mode === 'signup'
                        ? 'bg-brand-600 text-white shadow'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                    id="signup-tab"
                  >
                    Sign Up
                  </button>
                </div>
              )}

              {mode === 'forgot' && (
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-white mb-1">Reset Password</h2>
                  <p className="text-xs text-gray-400">
                    Enter your email to receive a password recovery link.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label htmlFor="full-name" className="label">
                      Full Name
                    </label>
                    <input
                      id="full-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                      className="input"
                      autoComplete="name"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="label">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="input"
                    autoComplete="email"
                  />
                </div>

                {mode !== 'forgot' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="password" className="label mb-0">
                        Password
                      </label>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setMode('forgot')
                            setError(null)
                          }}
                          className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Your password'}
                        required
                        minLength={mode === 'signup' ? 8 : undefined}
                        className="input pr-10"
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                        id="toggle-password"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Rich Error Alert */}
                {error && (
                  <div className="p-3.5 bg-red-900/30 border border-red-700/50 rounded-xl text-sm text-red-200 space-y-2 animate-fade-in">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="font-semibold text-red-300">{error.title}</p>
                        <p className="text-xs text-red-200/90 leading-relaxed">{error.message}</p>
                      </div>
                    </div>

                    {/* Quick Resolution Actions */}
                    {error.action === 'signup' && mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signup')
                          setError(null)
                        }}
                        className="text-xs text-brand-300 hover:text-brand-200 underline font-medium block pl-7"
                      >
                        👉 Don&apos;t have an account? Click here to Sign Up
                      </button>
                    )}

                    {error.action === 'signin' && mode === 'signup' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signin')
                          setError(null)
                        }}
                        className="text-xs text-brand-300 hover:text-brand-200 underline font-medium block pl-7"
                      >
                        👉 Already have an account? Click here to Sign In
                      </button>
                    )}

                    {error.action === 'resend' && (
                      <button
                        type="button"
                        onClick={handleResendConfirmation}
                        disabled={resending}
                        className="text-xs text-brand-300 hover:text-brand-200 underline font-medium block pl-7"
                      >
                        {resending ? 'Resending...' : '📩 Click here to resend confirmation email'}
                      </button>
                    )}

                    {error.action === 'schema' && (
                      <button
                        type="button"
                        onClick={() => setShowSetupGuide(true)}
                        className="text-xs text-purple-300 hover:text-purple-200 underline font-medium block pl-7"
                      >
                        ⚙️ View Supabase SQL setup instructions
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full justify-center py-2.5"
                  id="auth-submit-btn"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      {mode === 'signin'
                        ? 'Signing in...'
                        : mode === 'signup'
                        ? 'Creating account...'
                        : 'Sending reset link...'}
                    </>
                  ) : mode === 'signin' ? (
                    'Sign In'
                  ) : mode === 'signup' ? (
                    'Create Account'
                  ) : (
                    'Send Password Reset Link'
                  )}
                </button>

                {mode === 'forgot' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin')
                      setError(null)
                    }}
                    className="btn-ghost w-full justify-center py-2 text-sm text-gray-400"
                  >
                    Back to Sign In
                  </button>
                )}
              </form>

              {/* Demo Mode / Supabase Configuration Warning */}
              {!isSupabaseConfigured && (
                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg text-xs text-yellow-300">
                  ⚠️ Demo mode: Supabase credentials not configured. Authentication will not work until you add your Supabase URL and anon key to <code>.env.local</code>.
                </div>
              )}

              {/* Quick Fill Testing Credentials */}
              <div className="mt-6 pt-5 border-t border-surface-700/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Quick Test Accounts</span>
                  <span className="text-[10px] text-gray-500 font-mono">click to fill</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => fillQuickDemo('admin@trustvault.dev')}
                    className="px-2 py-1.5 rounded bg-surface-700/60 hover:bg-surface-700 text-xs text-purple-300 border border-purple-500/20 text-center truncate transition-colors"
                    title="Fill Admin test user"
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuickDemo('alice@trustvault.dev')}
                    className="px-2 py-1.5 rounded bg-surface-700/60 hover:bg-surface-700 text-xs text-blue-300 border border-blue-500/20 text-center truncate transition-colors"
                    title="Fill Owner test user"
                  >
                    Owner
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuickDemo('bob@trustvault.dev')}
                    className="px-2 py-1.5 rounded bg-surface-700/60 hover:bg-surface-700 text-xs text-green-300 border border-green-500/20 text-center truncate transition-colors"
                    title="Fill Viewer test user"
                  >
                    Viewer
                  </button>
                </div>
              </div>

              {/* Collapsible Supabase Setup Helper */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowSetupGuide(!showSetupGuide)}
                  className="flex items-center justify-between w-full py-2 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-brand-400" />
                    Supabase Database Setup Guide
                  </span>
                  {showSetupGuide ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {showSetupGuide && (
                  <div className="mt-2 p-3.5 bg-surface-700/50 rounded-xl border border-surface-600 text-xs text-gray-300 space-y-2.5 animate-fade-in">
                    <p className="font-medium text-white">To run TrustVault with a fresh Supabase project:</p>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                      <li>Open your <strong>Supabase Dashboard</strong></li>
                      <li>Navigate to <strong>SQL Editor</strong> &gt; <strong>New query</strong></li>
                      <li>
                        Paste and execute the migration file:
                        <code className="block mt-1 p-1.5 bg-surface-800 rounded font-mono text-[11px] text-brand-300">
                          supabase/COMPLETE_SETUP.sql
                        </code>
                      </li>
                      <li>
                        Under <strong>Auth &gt; Providers &gt; Email</strong>, disable <em>Confirm email</em> to allow instant logins.
                      </li>
                    </ol>
                    <button
                      type="button"
                      onClick={handleCopySetupSql}
                      className="btn-secondary w-full justify-center py-1.5 text-xs mt-2"
                    >
                      {copiedSql ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-400" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy SQL Setup Script Reference
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          TrustVault &mdash; Snovasys Fresher Hiring Challenge 2026
        </p>
      </div>
    </div>
  )
}
