import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import db from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const APPS = [
  { label: 'Docs',   description: 'Documents and rich text pages', color: 'bg-blue-500',   icon: '📄' },
  { label: 'Sheets', description: 'Spreadsheets and data tables',  color: 'bg-green-500',  icon: '📊' },
  { label: 'Mail',   description: 'Email, tasks, files, channels', color: 'bg-purple-500', icon: '✉️' },
  { label: 'Wiki',   description: 'Team knowledge base',           color: 'bg-amber-500',  icon: '📚' },
]

export default async function RootPage() {
  const session = await getSession()

  if (session) {
    if (session.orgId) redirect(`/org/${await getOrgSlug(session.orgId)}`)

    const memberRows = await db`
      SELECT o.slug FROM orgs o
      JOIN org_members m ON m.org_id = o.id
      WHERE m.user_id = ${session.userId}
      ORDER BY m.joined_at ASC LIMIT 1
    `
    if (memberRows.length) redirect(`/org/${memberRows[0].slug}`)
    redirect('/new-org')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="font-semibold text-gray-900">Foundry</span>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          Sign in →
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-8">
          <span className="text-white font-bold text-2xl">F</span>
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-4 tracking-tight">
          The open-source workspace
        </h1>
        <p className="text-xl text-gray-500 mb-12 max-w-xl mx-auto">
          Docs, Sheets, Mail, and Wiki — all in one place, on your own terms.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          {APPS.map(app => (
            <div
              key={app.label}
              className="bg-white rounded-2xl border border-gray-100 p-6 text-left"
            >
              <div className={`w-10 h-10 ${app.color} rounded-xl flex items-center justify-center text-xl mb-3`}>
                {app.icon}
              </div>
              <div className="font-semibold text-gray-900 text-sm">{app.label}</div>
              <div className="text-xs text-gray-400 mt-1 leading-relaxed">{app.description}</div>
            </div>
          ))}
        </div>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white font-medium px-8 py-3 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Get started →
        </Link>
      </main>
    </div>
  )
}

async function getOrgSlug(orgId: string): Promise<string> {
  const rows = await db`SELECT slug FROM orgs WHERE id = ${orgId}`
  return rows[0]?.slug ?? ''
}
