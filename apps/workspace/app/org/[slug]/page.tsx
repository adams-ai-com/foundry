import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import db from '@/lib/db'
import { logout } from '@/lib/actions'

export const dynamic = 'force-dynamic'

const APPS = [
  { id: 'docs',     label: 'Docs',     description: 'Documents and rich text pages', color: 'bg-blue-500',   icon: '📄', path: '/docs' },
  { id: 'sheets',   label: 'Sheets',   description: 'Spreadsheets and data tables',  color: 'bg-green-500',  icon: '📊', path: '/sheets' },
  { id: 'mail',     label: 'Mail',     description: 'Email, tasks, files, channels', color: 'bg-purple-500', icon: '✉️',  path: '/mail' },
  { id: 'wiki',     label: 'Wiki',     description: 'Team knowledge base',           color: 'bg-amber-500',  icon: '📚', path: '/wiki' },
]

export default async function OrgLauncherPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const orgRows = await db`
    SELECT o.id, o.name, o.slug FROM orgs o
    JOIN org_members m ON m.org_id = o.id
    WHERE o.slug = ${slug} AND m.user_id = ${session.userId}
  `
  if (!orgRows.length) notFound()
  const org = orgRows[0]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="font-semibold text-gray-900">{org.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{session.email}</span>
          <form action={logout}>
            <button className="text-sm text-gray-400 hover:text-gray-700">Sign out</button>
          </form>
        </div>
      </header>

      {/* App launcher */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Good to see you</h1>
        <p className="text-gray-500 mb-10">Pick an app to get started</p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {APPS.map(app => (
            <a
              key={app.id}
              href={app.path}
              className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md hover:border-gray-200 transition-all group"
            >
              <div className={`w-12 h-12 ${app.color} rounded-xl flex items-center justify-center text-2xl mb-4`}>
                {app.icon}
              </div>
              <div className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{app.label}</div>
              <div className="text-xs text-gray-400 mt-1 leading-relaxed">{app.description}</div>
            </a>
          ))}
        </div>
      </main>
    </div>
  )
}
