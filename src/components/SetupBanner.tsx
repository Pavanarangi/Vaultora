import { AlertTriangle, ExternalLink } from 'lucide-react'

export default function SetupBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-900/90 border-b border-yellow-700/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
        <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
        <span className="text-yellow-200">
          <strong>Setup required:</strong> Supabase is not configured. Copy{' '}
          <code className="bg-yellow-900/50 px-1 rounded font-mono">.env.example</code> to{' '}
          <code className="bg-yellow-900/50 px-1 rounded font-mono">.env.local</code> and add your Supabase credentials.
        </span>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-yellow-300 hover:text-yellow-100 transition-colors shrink-0"
        >
          Open Supabase <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}
