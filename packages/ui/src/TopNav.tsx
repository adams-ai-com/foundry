import type { SessionUser } from '@foundry/auth'

const APPS = [
  { id: 'docs',   label: 'Docs',   href: '/docs' },
  { id: 'sheets', label: 'Sheets', href: '/sheets' },
  { id: 'mail',   label: 'Mail',   href: '/mail' },
  { id: 'wiki',   label: 'Wiki',   href: '/wiki' },
] as const

type AppId = typeof APPS[number]['id']

interface TopNavProps {
  session: SessionUser
  activeApp?: AppId
  orgSlug?: string
}

export function TopNav({ session, activeApp, orgSlug }: TopNavProps) {
  const homeHref = orgSlug ? `/org/${orgSlug}` : '/'
  const initials = (session.name || session.email).slice(0, 2).toUpperCase()

  return (
    <header className="h-12 bg-white border-b border-gray-100 flex items-center px-4 gap-5 sticky top-0 z-50 shrink-0">
      <a href={homeHref} className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xs">F</span>
        </div>
        <span className="font-semibold text-gray-900 text-sm hidden sm:block">Foundry</span>
      </a>

      <nav className="flex items-center gap-0.5">
        {APPS.map(app => (
          <a
            key={app.id}
            href={app.href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeApp === app.id
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {app.label}
          </a>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400 cursor-pointer hover:bg-gray-100 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Search</span>
        <kbd className="ml-1 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-400">⌘K</kbd>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
          <span className="text-indigo-700 text-xs font-semibold">{initials}</span>
        </div>
        <span className="text-sm text-gray-500 hidden lg:block">{session.email}</span>
        <a href="/logout" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          Sign out
        </a>
      </div>
    </header>
  )
}
