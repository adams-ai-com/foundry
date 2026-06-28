import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import db from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function Logo() {
  return (
    <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-accent-fg" aria-hidden="true">
        <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h10a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h6a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1z"/>
      </svg>
    </div>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  )
}

function DocsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
}
function SheetsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
}
function MailIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
}
function ChannelsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
}
function WikiIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
}
function SitesIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/><path d="M8 13h8M8 17h5"/></svg>
}
function PDFIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/><path d="M9 13h6M9 17h4"/></svg>
}
function ShieldIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
}
function CodeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
}
function ServerIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
}
function AIIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
}

const APPS = [
  { id: 'pdf',      path: '/pdf',      label: 'PDF',      desc: 'Edit, annotate, sign, and redact PDFs. An open-source Acrobat Pro.',           Icon: PDFIcon,      ic: 'text-orange-500',  bg: 'bg-orange-500/10' },
  { id: 'docs',     path: '/docs',     label: 'Docs',     desc: 'Rich text editing with comments, version history, and collaborative blocks.',  Icon: DocsIcon,     ic: 'text-blue-500',    bg: 'bg-blue-500/10' },
  { id: 'sheets',   path: '/sheets',   label: 'Sheets',   desc: 'Spreadsheets with formulas, charts, pivot tables, and Python scripting.',      Icon: SheetsIcon,   ic: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'mail',     path: '/mail',     label: 'Mail',     desc: 'Email client backed by our own SMTP server. Own your inbox entirely.',          Icon: MailIcon,     ic: 'text-violet-500',  bg: 'bg-violet-500/10' },
  { id: 'channels', path: '/channels', label: 'Channels', desc: 'Real-time team chat with threads, video calls, and AI conversation memory.',   Icon: ChannelsIcon, ic: 'text-sky-500',     bg: 'bg-sky-500/10' },
  { id: 'wiki',     path: '/wiki',     label: 'Wiki',     desc: 'Structured knowledge base with nested pages and workspace-wide search.',       Icon: WikiIcon,     ic: 'text-amber-500',   bg: 'bg-amber-500/10' },
  { id: 'sites',    path: '/sites',    label: 'Sites',    desc: 'Internal sites, file management, and team portals — all in one place.',        Icon: SitesIcon,    ic: 'text-rose-500',    bg: 'bg-rose-500/10' },
]

const SELF_HOST_FEATURES = [
  {
    Icon: ShieldIcon,
    title: 'Your data stays yours',
    desc: 'Runs on your server. No telemetry, no document scanning, no training on your content.',
  },
  {
    Icon: CodeIcon,
    title: 'Fully auditable',
    desc: 'AGPL-licensed and open source. Read every line, fork it, modify it, run it however you need.',
  },
  {
    Icon: ServerIcon,
    title: 'Deploy modularly',
    desc: 'Install just Mail. Just Docs. Or the full workspace. Each app is independently deployable.',
  },
  {
    Icon: AIIcon,
    title: 'AI-native',
    desc: 'Search across mail, docs, channels, and decisions in one query. AI understands your whole workspace.',
  },
]

export default async function RootPage() {
  const session = await getSession()
  if (session) {
    const orgRows = await db`
      SELECT o.id, o.name, o.slug FROM orgs o
      JOIN org_members m ON m.org_id = o.id
      WHERE m.user_id = ${session.userId}
      LIMIT 1
    `
    const org = orgRows[0]
    if (org) {
      const accessRows = await db`
        SELECT app, enabled FROM user_app_access
        WHERE org_id = ${org.id} AND user_id = ${session.userId}
      ` as unknown as Array<{ app: string; enabled: boolean }>
      const disabledApps = new Set(accessRows.filter(r => !r.enabled).map(r => r.app))
      const allowedApps = APPS.filter(a => !disabledApps.has(a.id))

      if (allowedApps.length === 1) redirect(allowedApps[0].path)

      // Multiple apps — render the launcher
      const hour = new Date().getHours()
      const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
      const namePart = session.email.split('@')[0]
      const firstName = namePart.includes('.') ? namePart.split('.')[0] : namePart
      const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1)
      const initials = (displayName[0] ?? 'U').toUpperCase()

      return (
        <div className="min-h-screen bg-bg-base">
          <header className="h-14 border-b border-border bg-bg-raised/80 backdrop-blur-sm sticky top-0 z-10 flex items-center px-6 gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-accent-fg">
                  <path d="M4 5a1 1 0 011-1h14a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h10a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h6a1 1 0 010 2H5a1 1 0 01-1-1z"/>
                </svg>
              </div>
              <span className="font-semibold text-fg-primary text-sm tracking-tight">OpenWork Loft</span>
              <span className="text-border hidden sm:block text-lg leading-none">·</span>
              <span className="text-fg-tertiary text-sm truncate hidden sm:block max-w-[200px]">{org.name}</span>
            </div>
            <nav className="flex items-center gap-0.5">
              {allowedApps.map(({ id, path, label }) => (
                <a
                  key={id}
                  href={path}
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-fg-secondary hover:text-fg-primary hover:bg-bg-hover transition-colors"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="flex-1" />
            {(session.role === 'owner' || session.role === 'admin') && (
              <a href="/admin" className="text-xs font-medium text-fg-tertiary hover:text-fg-primary transition-colors px-2 py-1 rounded hover:bg-bg-hover">
                Admin
              </a>
            )}
            <div className="flex items-center gap-2 pl-3 border-l border-border ml-1">
              <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                <span className="text-accent text-xs font-bold">{initials}</span>
              </div>
              <span className="text-fg-secondary text-xs hidden sm:block truncate max-w-[160px]">{session.email}</span>
            </div>
            <a href="/logout" className="text-xs text-fg-tertiary hover:text-fg-primary transition-colors ml-1 px-2 py-1 rounded hover:bg-bg-hover">
              Sign out
            </a>
          </header>

          <main className="max-w-3xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-widest mb-3">
              {org.name}
            </p>
            <h1 className="text-3xl font-bold text-fg-primary tracking-tight mb-8">
              {greeting}, {displayName}.
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allowedApps.map(({ id, path, label, desc, Icon, ic, bg }) => (
                <a
                  key={id}
                  href={path}
                  className="group rounded-2xl border border-border bg-bg-surface hover:bg-bg-raised hover:border-accent/30 hover:shadow-[0_2px_18px_rgb(0_0_0/.07)] transition-all duration-200 p-6 flex flex-col gap-4"
                >
                  <div className={`w-10 h-10 rounded-xl ${bg} ${ic} flex items-center justify-center`}>
                    <Icon />
                  </div>
                  <div>
                    <div className="text-[13.5px] font-semibold text-fg-primary mb-1">{label}</div>
                    <div className="text-[12.5px] text-fg-secondary leading-relaxed">{desc}</div>
                  </div>
                </a>
              ))}
            </div>
          </main>
        </div>
      )
    }
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-bg-base">

      {/* Header */}
      <header className="h-14 border-b border-border bg-bg-base/80 backdrop-blur-sm sticky top-0 z-10 flex items-center px-6 justify-between">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-semibold text-fg-primary text-sm">OpenWork Loft</span>
        </div>
        <nav className="flex items-center gap-5">
          <a href="#apps" className="hidden sm:block text-sm text-fg-secondary hover:text-fg-primary transition-colors">Apps</a>
          <a href="#self-host" className="hidden sm:block text-sm text-fg-secondary hover:text-fg-primary transition-colors">Self-host</a>
          <Link href="/pricing" className="hidden sm:block text-sm text-fg-secondary hover:text-fg-primary transition-colors">Pricing</Link>
          <a href="https://github.com/adams-ai-com/foundry" className="hidden sm:flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg-primary transition-colors">
            <GitHubIcon /> GitHub
          </a>
          <Link href="/login" className="text-sm font-medium bg-bg-raised border border-border hover:bg-bg-hover text-fg-primary px-4 py-1.5 rounded-lg transition-colors">
            Sign in →
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-24 text-center px-6">
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 w-[900px] h-[500px] rounded-full bg-accent/6 blur-[120px]" />
        <div className="pointer-events-none absolute left-1/3 top-20 w-[300px] h-[300px] rounded-full bg-blue-500/4 blur-[80px]" />
        <div className="pointer-events-none absolute right-1/4 top-32 w-[250px] h-[250px] rounded-full bg-violet-500/4 blur-[80px]" />

        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-bg-surface border border-border text-fg-secondary text-xs px-3 py-1.5 rounded-full mb-8 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Open source · Self-hostable · AGPL-3.0
          </div>

          <h1 className="text-5xl sm:text-7xl font-semibold text-fg-primary tracking-tight mb-6 leading-[1.05]">
            The workspace<br />
            <span className="text-accent">you actually own</span>
          </h1>

          <p className="text-xl text-fg-secondary mb-4 max-w-xl mx-auto leading-relaxed">
            Docs, Sheets, Mail, Channels, Wiki — AI-native, self-hosted, open source.
          </p>
          <p className="text-sm text-fg-tertiary mb-10 max-w-lg mx-auto leading-relaxed">
            Built because organizations deserve software they can inspect, modify, and run forever — without a vendor between them and their data.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-fg font-medium px-7 py-3 rounded-lg text-sm transition-all duration-150 shadow-lg shadow-accent/20">
              Get started →
            </Link>
            <a href="https://github.com/adams-ai-com/foundry" className="inline-flex items-center gap-2 bg-bg-raised hover:bg-bg-hover text-fg-secondary hover:text-fg-primary border border-border font-medium px-7 py-3 rounded-lg text-sm transition-all duration-150">
              <GitHubIcon /> View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="border-t border-border bg-bg-surface px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-widest text-center mb-10">Why it exists</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                heading: "You don't own your data",
                body: "Microsoft and Google run your documents on their servers, read your content to improve their models, and can revoke access at any time.",
              },
              {
                heading: 'Everything is rented',
                body: "Cancel a subscription and lose access to years of documents, email history, and team knowledge — instantly.",
              },
              {
                heading: "Apps don't talk to each other",
                body: "Mail, files, chat, and docs live in separate silos. Decisions made in meetings can't be found six months later.",
              },
            ].map(({ heading, body }) => (
              <div key={heading} className="bg-bg-raised border border-border rounded-xl p-6">
                <div className="w-2 h-2 rounded-full bg-accent mb-4" />
                <h3 className="font-semibold text-fg-primary text-sm mb-2">{heading}</h3>
                <p className="text-fg-secondary text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Apps */}
      <section id="apps" className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-widest text-center mb-3">The full suite</p>
          <h2 className="text-3xl font-semibold text-fg-primary text-center mb-2 tracking-tight">Everything you need. Nothing you don&apos;t.</h2>
          <p className="text-fg-secondary text-center text-sm mb-12">Each app is independently deployable and independently excellent.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {APPS.map(({ label, desc, Icon, ic, bg }) => (
              <div key={label} className="bg-bg-raised border border-border rounded-xl p-5 hover:border-accent/30 transition-colors">
                <div className={`w-10 h-10 rounded-xl ${bg} ${ic} flex items-center justify-center mb-3`}>
                  <Icon />
                </div>
                <div className="font-semibold text-fg-primary text-sm mb-1">{label}</div>
                <div className="text-fg-tertiary text-xs leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workspace-first */}
      <section className="border-t border-border bg-bg-surface px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-widest mb-3">Workspace-first</p>
              <h2 className="text-3xl font-semibold text-fg-primary tracking-tight mb-4 leading-tight">
                Organized around work,<br />not apps
              </h2>
              <p className="text-fg-secondary text-sm leading-relaxed mb-4">
                Microsoft and Google made the same mistake: they built apps first, then tried to connect them. Mail in one place, files in another, chat in a third.
              </p>
              <p className="text-fg-secondary text-sm leading-relaxed">
                OpenWork Loft organizes around <strong className="text-fg-primary font-semibold">workspaces</strong> — a project, a client, a team. Every conversation, document, and decision lives together. Search spans all of it. AI understands all of it.
              </p>
            </div>
            <div className="bg-bg-raised border border-border rounded-xl p-6 font-mono text-xs text-fg-secondary leading-7">
              <div className="text-accent font-semibold mb-1">WORKSPACE</div>
              <div><span className="text-fg-tertiary">  ├── </span><span className="text-blue-400">Conversations</span>  <span className="text-fg-tertiary">mail + channels</span></div>
              <div><span className="text-fg-tertiary">  ├── </span><span className="text-emerald-400">Documents</span>     <span className="text-fg-tertiary">Docs + Sheets</span></div>
              <div><span className="text-fg-tertiary">  ├── </span><span className="text-violet-400">Mail</span>          <span className="text-fg-tertiary">your own server</span></div>
              <div><span className="text-fg-tertiary">  ├── </span><span className="text-amber-400">Wiki</span>          <span className="text-fg-tertiary">team knowledge</span></div>
              <div><span className="text-fg-tertiary">  ├── </span><span className="text-rose-400">Files</span>         <span className="text-fg-tertiary">any file type</span></div>
              <div><span className="text-fg-tertiary">  └── </span><span className="text-sky-400">Tasks + Decisions</span></div>
              <div className="mt-4 text-fg-tertiary">Search spans all of it.</div>
              <div className="text-accent">AI understands all of it.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Self-host features */}
      <section id="self-host" className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-widest text-center mb-3">Self-hosted by design</p>
          <h2 className="text-3xl font-semibold text-fg-primary text-center tracking-tight mb-12">Software that works for you</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SELF_HOST_FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} className="bg-bg-raised border border-border rounded-xl p-6">
                <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-4">
                  <Icon />
                </div>
                <div className="font-semibold text-fg-primary text-sm mb-2">{title}</div>
                <p className="text-fg-tertiary text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OSS / License */}
      <section className="border-t border-border bg-bg-surface px-6 py-20 text-center">
        <div className="max-w-xl mx-auto">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 text-accent mb-6">
            <CodeIcon />
          </div>
          <h2 className="text-2xl font-semibold text-fg-primary tracking-tight mb-3">Licensed AGPL-3.0</h2>
          <p className="text-fg-secondary text-sm leading-relaxed mb-8">
            Same model as Nextcloud, GitLab, and Signal. Anyone can read, fork, and self-host. Improvements made to hosted versions flow back to the community. No commercial take-and-keep.
          </p>
          <a href="https://github.com/adams-ai-com/foundry" className="inline-flex items-center gap-2 bg-bg-raised hover:bg-bg-hover border border-border text-fg-primary font-medium px-6 py-2.5 rounded-lg text-sm transition-colors">
            <GitHubIcon /> adams-ai-com/foundry
          </a>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-border px-6 py-24 text-center">
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 w-[700px] h-[400px] rounded-full bg-accent/5 blur-[100px]" />
        <div className="relative max-w-lg mx-auto">
          <h2 className="text-4xl sm:text-5xl font-semibold text-fg-primary tracking-tight mb-4 leading-tight">
            Ready to own<br />your workspace?
          </h2>
          <p className="text-fg-secondary text-sm mb-8">Get started in minutes — or deploy it yourself.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-fg font-medium px-8 py-3 rounded-lg text-sm transition-all shadow-lg shadow-accent/20">
              Get started →
            </Link>
            <a href="https://github.com/adams-ai-com/foundry" className="inline-flex items-center gap-2 bg-bg-raised hover:bg-bg-hover border border-border text-fg-secondary hover:text-fg-primary font-medium px-8 py-3 rounded-lg text-sm transition-colors">
              <GitHubIcon /> Self-host
            </a>
          </div>
          <p className="mt-6 text-xs text-fg-tertiary">
            Managed hosting available from{' '}
            <a href="https://adams-ai.com" className="text-fg-secondary hover:text-fg-primary underline underline-offset-2 transition-colors">Adams AI</a>.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-sm font-medium text-fg-primary">OpenWork Loft</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-fg-tertiary">
            <Link href="/pricing" className="hover:text-fg-secondary transition-colors">Pricing</Link>
            <span>AGPL-3.0</span>
            <a href="https://github.com/adams-ai-com/foundry" className="hover:text-fg-secondary transition-colors">GitHub</a>
            <span>Built by Adams AI</span>
          </div>
        </div>
      </footer>

    </div>
  )
}

async function getOrgSlug(orgId: string): Promise<string> {
  const rows = await db`SELECT slug FROM orgs WHERE id = ${orgId}`
  return rows[0]?.slug ?? ''
}
