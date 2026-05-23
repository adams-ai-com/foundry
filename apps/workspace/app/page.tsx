import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import db from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function DocsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
}
function SheetsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
}
function MailIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
}
function WikiIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
}
function SitesIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/><path d="M8 13h8M8 17h5"/></svg>
}

const APPS = [
  { label: 'Docs',   desc: 'Rich text documents',   Icon: DocsIcon,   ic: 'text-blue-500',    bg: 'bg-blue-500/10' },
  { label: 'Sheets', desc: 'Spreadsheets & data',   Icon: SheetsIcon, ic: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { label: 'Mail',   desc: 'Email & team channels', Icon: MailIcon,   ic: 'text-violet-500',  bg: 'bg-violet-500/10' },
  { label: 'Wiki',   desc: 'Team knowledge base',   Icon: WikiIcon,   ic: 'text-amber-500',   bg: 'bg-amber-500/10' },
  { label: 'Sites',  desc: 'Team sites & files',    Icon: SitesIcon,  ic: 'text-rose-500',    bg: 'bg-rose-500/10' },
]

export default async function RootPage() {
  const session = await getSession()
  if (session) {
    if (session.orgId) redirect(`/org/${await getOrgSlug(session.orgId)}`)
    const rows = await db`SELECT o.slug FROM orgs o JOIN org_members m ON m.org_id = o.id WHERE m.user_id = ${session.userId} ORDER BY m.joined_at ASC LIMIT 1`
    if (rows.length) redirect(`/org/${rows[0].slug}`)
    redirect('/new-org')
  }

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="h-14 border-b border-border bg-bg-base/80 backdrop-blur-sm sticky top-0 z-10 flex items-center px-6 justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-accent-fg" aria-hidden="true">
              <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h10a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h6a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1z"/>
            </svg>
          </div>
          <span className="font-semibold text-fg-primary text-sm">Foundry</span>
        </div>
        <Link href="/login" className="text-sm font-medium text-fg-secondary hover:text-fg-primary transition-colors">
          Sign in →
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-24 pb-32 text-center relative">
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 w-[700px] h-[400px] rounded-full bg-accent/5 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-bg-surface border border-border text-fg-secondary text-xs px-3 py-1.5 rounded-full mb-8 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Open source · Self-hostable · AGPL
          </div>

          <h1 className="text-5xl sm:text-6xl font-semibold text-fg-primary tracking-tight mb-5 leading-[1.1]">
            The workspace<br /><span className="text-accent">built to last</span>
          </h1>
          <p className="text-lg text-fg-secondary mb-10 max-w-md mx-auto leading-relaxed">
            Docs, Sheets, Mail, and Wiki — owned by you, not a SaaS vendor.
          </p>

          <div className="flex items-center justify-center gap-3 mb-20">
            <Link href="/login" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-fg font-medium px-6 py-2.5 rounded-lg text-sm transition-all duration-150 shadow-md">
              Get started →
            </Link>
            <a href="https://github.com/adams-ai-com/foundry" className="inline-flex items-center gap-2 bg-bg-raised hover:bg-bg-hover text-fg-secondary hover:text-fg-primary border border-border font-medium px-6 py-2.5 rounded-lg text-sm transition-all duration-150">
              GitHub →
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
            {APPS.map(({ label, desc, Icon, ic, bg }) => (
              <div key={label} className="bg-bg-raised rounded-xl border border-border p-5">
                <div className={`w-9 h-9 rounded-lg ${bg} ${ic} flex items-center justify-center mb-3`}>
                  <Icon />
                </div>
                <div className="font-medium text-fg-primary text-sm">{label}</div>
                <div className="text-fg-tertiary text-xs mt-0.5 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

async function getOrgSlug(orgId: string): Promise<string> {
  const rows = await db`SELECT slug FROM orgs WHERE id = ${orgId}`
  return rows[0]?.slug ?? ''
}
