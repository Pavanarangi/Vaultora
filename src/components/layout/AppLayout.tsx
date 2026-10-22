import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import {
  LayoutDashboard,
  FileText,
  Share2,
  ClipboardList,
  Shield,
  LogOut,
  Lock,
  ChevronRight,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { isSupabaseConfigured } from '../../lib/supabase'
import toast from 'react-hot-toast'

const navLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/shared', icon: Share2, label: 'Shared with Me' },
  { to: '/audit', icon: ClipboardList, label: 'Audit Log' },
]

const adminLink = { to: '/admin', icon: Shield, label: 'Admin' }

export default function AppLayout() {
  const { profile, signOut } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out successfully')
    navigate('/login')
  }

  const roleColors = {
    administrator: 'badge-admin',
    owner: 'badge-owner',
    viewer: 'badge-viewer',
  }

  return (
    <div className={cn('flex min-h-screen bg-surface-900', !isSupabaseConfigured && 'pt-9')}>
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-surface-800 border-r border-surface-600 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-surface-600">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/30">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm tracking-tight">TrustVault</h1>
              <p className="text-xs text-gray-500">Secure Document Manager</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navLinks.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn('group', isActive ? 'sidebar-link-active' : 'sidebar-link')
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
              <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          ))}

          {profile?.role === 'administrator' && (
            <NavLink
              to={adminLink.to}
              className={({ isActive }) =>
                cn('group', isActive ? 'sidebar-link-active' : 'sidebar-link', 'mt-2')
              }
            >
              <adminLink.icon className="w-4 h-4 shrink-0 text-purple-400" />
              <span>Admin</span>
              <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          )}
        </nav>

        {/* User Profile */}
        <div className="px-3 py-4 border-t border-surface-600">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-700 mb-2">
            <div className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-600/30 flex items-center justify-center text-sm font-semibold text-brand-400">
              {profile?.full_name?.[0]?.toUpperCase() ?? profile?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">
                {profile?.full_name ?? profile?.email ?? 'User'}
              </p>
              <span className={cn(roleColors[profile?.role ?? 'viewer'], 'mt-0.5')}>
                {profile?.role ?? 'viewer'}
              </span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-900/20"
            id="signout-btn"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
