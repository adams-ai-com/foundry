import type { SessionUser } from '@foundry/auth'
import { ThemeSwitcher } from './ThemeSwitcher'

const APPS = [
  { id: 'docs',     label: 'Docs',     href: '/docs' },
  { id: 'sheets',   label: 'Sheets',   href: '/sheets' },
  { id: 'mail',     label: 'Mail',     href: '/mail' },
  { id: 'channels', label: 'Channels', href: '/channels' },
  { id: 'wiki',     label: 'Wiki',     href: '/wiki' },
  { id: 'sites',    label: 'Sites',    href: '/sites' },
  { id: 'pdf',      label: 'PDF',      href: '/pdf' },
] as const

type AppId = typeof APPS[number]['id']
type Theme = 'light' | 'dark' | 'warm'

interface TopNavProps {
  session: SessionUser
  activeApp?: AppId
  orgSlug?: string
  theme?: Theme
  allowedApps?: string[]
}

export function TopNav({ session, activeApp, orgSlug, theme = 'light', allowedApps }: TopNavProps) {
  const initials = (session.name || session.email).slice(0, 2).toUpperCase()
  const visibleApps = allowedApps ? APPS.filter(a => allowedApps.includes(a.id)) : APPS

  return (
    <header className="h-12 bg-bg-raised border-b border-border flex items-center px-4 gap-4 sticky top-0 z-50 shrink-0">
      <a href="/" className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-accent-fg" aria-hidden="true">
            <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h10a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h6a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1z"/>
          </svg>
        </div>
        <span className="font-semibold text-fg-primary text-sm hidden sm:block">Foundry</span>
      </a>

      {visibleApps.length > 1 && (
        <nav className="flex items-center gap-0.5">
          {visibleApps.map(app => (
            <a
              key={app.id}
              href={app.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeApp === app.id
                  ? 'bg-bg-active text-accent'
                  : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-hover'
              }`}
            >
              {app.label}
            </a>
          ))}
        </nav>
      )}

      <div className="flex-1" />

      <ThemeSwitcher defaultTheme={theme} />

      <div className="flex items-center gap-3 shrink-0 ml-1">
        <div className="w-7 h-7 bg-accent/15 rounded-full flex items-center justify-center shrink-0">
          <span className="text-accent text-xs font-semibold">{initials}</span>
        </div>
        <span className="text-sm text-fg-secondary hidden lg:block">{session.email}</span>
        <a href="/logout" className="text-sm text-fg-tertiary hover:text-fg-primary transition-colors">
          Sign out
        </a>
      </div>
    </header>
  )
}
