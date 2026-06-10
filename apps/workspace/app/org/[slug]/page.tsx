import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth'
import db from '@/lib/db'
import { logout } from '@/lib/actions'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'

export const dynamic = 'force-dynamic'

// ── App icons ──────────────────────────────────────────────────────────────────

function DocsIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
  )
}
function SheetsIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18M3 15h18M9 3v18"/>
    </svg>
  )
}
function MailIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
    </svg>
  )
}
function WikiIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
    </svg>
  )
}

function SitesIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
    </svg>
  )
}
function PdfIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M9 13h1.5a1.5 1.5 0 010 3H9v-3zm0 3v2m4-5h1a2 2 0 010 4h-1V13z"/>
    </svg>
  )
}
function ArrowIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
    </svg>
  )
}

// ── Feature icons ──────────────────────────────────────────────────────────────

function SparkIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
    </svg>
  )
}
function CodeIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
    </svg>
  )
}
function ServerIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="20" height="8" rx="2"/>
      <rect x="2" y="14" width="20" height="8" rx="2"/>
      <path d="M6 6h.01M6 18h.01"/>
    </svg>
  )
}
function GridIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}
function SendIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}
function PaletteIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
      <path d="M12 2C6.5 2 2 6.5 2 12a10 10 0 0010 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
    </svg>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <h2 className="text-[11px] font-semibold text-fg-tertiary uppercase tracking-[0.18em] whitespace-nowrap">
        {label}
      </h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

// ── Data ───────────────────────────────────────────────────────────────────────

const APPS = [
  {
    id: 'docs',
    label: 'Docs',
    desc: 'Rich documents, reports, and notes with a world-class editing experience.',
    path: '/docs',
    Icon: DocsIcon,
  },
  {
    id: 'sheets',
    label: 'Sheets',
    desc: 'Spreadsheets, data models, and formulas — with Python scripting built in.',
    path: '/sheets',
    Icon: SheetsIcon,
  },
  {
    id: 'mail',
    label: 'Mail',
    desc: 'Email, channels, and messaging — organized with labels and a built-in SMTP server.',
    path: '/mail',
    Icon: MailIcon,
  },
  {
    id: 'wiki',
    label: 'Wiki',
    desc: 'A nested knowledge base for your team. Write, organize, and find anything.',
    path: '/wiki',
    Icon: WikiIcon,
  },
  {
    id: 'channels',
    label: 'Channels',
    desc: 'Real-time team messaging — streams, topics, and direct messages.',
    path: '/org',
    Icon: WikiIcon,
  },
  {
    id: 'sites',
    label: 'Sites',
    desc: 'Team sites with folders and member-level permissions — a better SharePoint.',
    path: '/sites',
    Icon: SitesIcon,
  },
  {
    id: 'pdf',
    label: 'PDF',
    desc: 'Edit, annotate, redact, and sign PDF documents — plus convert to and from Office formats.',
    path: '/pdf',
    Icon: PdfIcon,
  },
]

const FEATURES = [
  {
    title: 'AI-native',
    desc: 'Intelligent assistance woven through every app. Write, analyze, and summarize — AI is always close at hand.',
    Icon: SparkIcon,
  },
  {
    title: 'Open source',
    desc: 'Every line of code is public under AGPL-3.0. Inspect it, fork it, or run it entirely on your own infrastructure.',
    Icon: CodeIcon,
  },
  {
    title: 'Self-hosted',
    desc: 'Your documents, emails, and data never leave your servers. Full control, no subscriptions.',
    Icon: ServerIcon,
  },
  {
    title: 'Unified workspace',
    desc: 'Mail, docs, sheets, and wiki in one place — consistent UI, shared search, single login.',
    Icon: GridIcon,
  },
  {
    title: 'Built-in mail server',
    desc: 'Not just a client — Foundry ships its own SMTP server. Send email from your own domain, fully self-contained.',
    Icon: SendIcon,
  },
  {
    title: 'Crafted themes',
    desc: 'Three handcrafted themes — Light, Dark, and Warm — designed to be a pleasure to use every day.',
    Icon: PaletteIcon,
  },
]

const ROADMAP = [
  { label: 'CC / BCC in compose',      timeline: 'Q2 2026' },
  { label: 'Calendar event creation',  timeline: 'Q2 2026' },
  { label: 'File attachments',         timeline: 'Q2 2026' },
  { label: 'PDF export',               timeline: 'Q2 2026' },
  { label: 'Real-time collaboration',  timeline: 'Q3 2026' },
  { label: 'Contact management',       timeline: 'Q3 2026' },
  { label: 'Draft auto-save',          timeline: 'Q3 2026' },
  { label: 'Mobile apps',             timeline: 'Q4 2026' },
  { label: 'REST API',                 timeline: 'Q4 2026' },
  { label: 'Offline mode',             timeline: 'Q4 2026' },
  { label: 'Sites — file preview',     timeline: 'Q2 2026' },
  { label: 'Sites — version history',  timeline: 'Q3 2026' },
  { label: 'Sites — search',           timeline: 'Q3 2026' },
]

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function OrgLauncherPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const orgRows = await db`
    SELECT o.id, o.name FROM orgs o
    JOIN org_members m ON m.org_id = o.id
    WHERE o.slug = ${slug} AND m.user_id = ${session.userId}
  `
  if (!orgRows.length) notFound()
  const org = orgRows[0]

  // Filter apps by user's access settings (no row = enabled by default)
  const accessRows = await db`
    SELECT app, enabled FROM user_app_access
    WHERE org_id = ${org.id} AND user_id = ${session.userId}
  ` as unknown as Array<{ app: string; enabled: boolean }>
  const disabledApps = new Set(accessRows.filter(r => !r.enabled).map(r => r.app))
  const allowedApps = APPS.filter(a => !disabledApps.has(a.id))

  if (allowedApps.length === 1) redirect(allowedApps[0].path)

  const jar = await cookies()
  const theme = (jar.get('foundry_theme')?.value ?? 'light') as 'light' | 'dark' | 'warm'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const namePart = session.email.split('@')[0]
  const firstName = namePart.includes('.') ? namePart.split('.')[0] : namePart
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1)
  const initials = (displayName[0] ?? 'U').toUpperCase()

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-bg-base">

      {/* ── Sticky header ───────────────────────────────────────────────────── */}
      <header className="h-14 border-b border-border bg-bg-raised/80 backdrop-blur-sm sticky top-0 z-10 flex items-center px-6 gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-accent-fg">
              <path d="M4 5a1 1 0 011-1h14a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h10a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h6a1 1 0 010 2H5a1 1 0 01-1-1z"/>
            </svg>
          </div>
          <span className="font-semibold text-fg-primary text-sm tracking-tight">Foundry</span>
          <span className="text-border hidden sm:block text-lg leading-none">·</span>
          <span className="text-fg-tertiary text-sm truncate hidden sm:block max-w-[200px]">{org.name}</span>
        </div>

        <div className="flex-1" />
        <ThemeSwitcher current={theme} />

        {(session.role === 'owner' || session.role === 'admin') && (
          <a
            href="/admin"
            className="text-xs font-medium text-fg-tertiary hover:text-fg-primary transition-colors px-2 py-1 rounded hover:bg-bg-hover flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Admin
          </a>
        )}
                <div className="flex items-center gap-2 pl-3 border-l border-border ml-1">
          <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
            <span className="text-accent text-xs font-bold">{initials}</span>
          </div>
          <span className="text-fg-secondary text-xs hidden sm:block truncate max-w-[160px]">{session.email}</span>
        </div>

        <form action={logout}>
          <button className="text-xs text-fg-tertiary hover:text-fg-primary transition-colors ml-1 px-2 py-1 rounded hover:bg-bg-hover">
            Sign out
          </button>
        </form>
      </header>

      {/* ── Hero — compact ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 55% 160% at 88% -10%, rgb(var(--accent) / .09), transparent 65%)',
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgb(var(--fg-primary) / .022) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--fg-primary) / .022) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        <div className="relative max-w-5xl mx-auto px-6 py-10 md:py-14">
          <p className="text-[10.5px] font-semibold text-fg-tertiary uppercase tracking-[0.22em] mb-4">
            {dateStr}
          </p>
          <h1 className="text-3xl md:text-[2.25rem] font-bold tracking-tight text-fg-primary/80 leading-snug">
            {greeting}, {displayName}.
          </h1>
          <p className="text-sm text-fg-tertiary mt-2">{org.name} Workspace</p>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-14">

        {/* ── App launcher ────────────────────────────────────────────────── */}
        <section>
          <SectionHeader label="Your apps" />
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allowedApps.map(({ id, label, desc, path, Icon }) => (
              <a
                key={id}
                href={path}
                className="group relative rounded-2xl border border-border bg-bg-surface
                           hover:bg-bg-raised hover:border-accent/30
                           hover:shadow-[0_2px_18px_rgb(0_0_0/.07)]
                           transition-all duration-200 p-6 flex flex-col gap-6"
              >
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center
                                 bg-bg-raised group-hover:bg-accent/10 transition-colors duration-200 border border-border">
                    <Icon className="w-5 h-5 text-accent/50 group-hover:text-accent transition-colors duration-200" />
                  </div>
                  <div className="flex items-center gap-1 text-fg-tertiary group-hover:text-accent transition-colors duration-150">
                    <span className="text-[11px] font-medium translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
                      Open
                    </span>
                    <ArrowIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
                  </div>
                </div>

                <div>
                  <div className="text-[13.5px] font-semibold text-fg-primary mb-1.5">
                    {label}
                  </div>
                  <div className="text-[12.5px] text-fg-secondary leading-relaxed">
                    {desc}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* ── Why Foundry ──────────────────────────────────────────────────── */}
        <section>
          <SectionHeader label="Why Foundry" />
          <p className="mt-2 mb-5 text-sm text-fg-secondary leading-relaxed max-w-2xl">
            A modern, open alternative to Microsoft 365 and Google Workspace — built for teams that care about
            privacy, ownership, and craft.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map(({ title, desc, Icon }) => (
              <div
                key={title}
                className="group rounded-xl border border-border bg-bg-surface p-5
                           hover:bg-bg-raised hover:border-accent/20 transition-all duration-150"
              >
                <div className="w-7 h-7 rounded-lg bg-bg-raised border border-border flex items-center justify-center mb-4
                               group-hover:bg-accent/10 group-hover:border-accent/20 transition-all duration-150">
                  <Icon className="w-[18px] h-[18px] text-accent/50 group-hover:text-accent transition-colors duration-150" />
                </div>
                <h3 className="text-[13px] font-semibold text-fg-primary mb-1.5">{title}</h3>
                <p className="text-[12px] text-fg-secondary leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Roadmap ──────────────────────────────────────────────────────── */}
        <section>
          <SectionHeader label="On the roadmap" />
          <p className="mt-2 mb-5 text-sm text-fg-secondary leading-relaxed">
            Features actively being built for upcoming releases. The workspace gets better every week.
          </p>

          <div className="flex flex-wrap gap-2">
            {ROADMAP.map(({ label, timeline }) => (
              <div
                key={label}
                className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-full border border-border bg-bg-surface
                           hover:border-accent/30 hover:bg-bg-raised transition-all duration-150 cursor-default"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-[12.5px] text-fg-secondary font-medium">{label}</span>
                <span
                  className="text-[10.5px] text-fg-tertiary px-2 py-0.5 rounded-full"
                  style={{ background: 'rgb(var(--bg-hover))' }}
                >
                  {timeline}
                </span>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border mt-8">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-accent/15 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-accent">
                  <path d="M4 5a1 1 0 011-1h14a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h10a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h6a1 1 0 010 2H5a1 1 0 01-1-1z"/>
                </svg>
              </div>
              <span className="text-xs font-semibold text-fg-secondary">Foundry</span>
            </div>
            <span className="text-fg-tertiary/40 text-xs hidden sm:block">·</span>
            <span className="text-xs text-fg-tertiary hidden sm:block">Open source workspace</span>
            <span className="text-fg-tertiary/40 text-xs hidden sm:block">·</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
              AGPL-3.0
            </span>
          </div>
          <p className="text-xs text-fg-tertiary">Built with care by Adams AI</p>
        </div>
      </footer>

    </div>
  )
}
