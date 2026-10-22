import { Link } from 'react-router-dom'
import { Lock, Home } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-700 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-gray-500" />
        </div>
        <h1 className="text-6xl font-bold text-gradient mb-2">404</h1>
        <h2 className="text-xl font-semibold text-gray-300 mb-2">Page Not Found</h2>
        <p className="text-gray-500 mb-8">The page you're looking for doesn't exist or you don't have access.</p>
        <Link to="/dashboard" className="btn-primary">
          <Home className="w-4 h-4" />
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
