import { requireSession } from '@owl/auth'
import { AdminView } from '../../components/AdminView'

export default async function AdminPage() {
  await requireSession()
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <a href="/mail" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            Mail
          </a>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-900">Admin</span>
        </div>
      </header>
      <AdminView />
    </div>
  )
}
