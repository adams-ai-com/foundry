import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { getSession } from '@owl/auth'
import { TopNav } from '@owl/ui'
import postgres from 'postgres'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'OWL PDF',
  description: 'PDF editing, forms, conversion, and redaction — part of OpenWork Loft',
}

let _wsDb: ReturnType<typeof postgres> | null = null
function wsDb() {
  if (!_wsDb) {
    const url = process.env.WORKSPACE_DATABASE_URL ?? process.env.DATABASE_URL
    if (url) _wsDb = postgres(url, { max: 2 })
  }
  return _wsDb
}

async function getAllowedApps(userId: string, orgId: string): Promise<string[]> {
  const db = wsDb()
  if (!db) return []
  const ALL_APPS = ['docs', 'sheets', 'mail', 'channels', 'wiki', 'sites', 'pdf']
  try {
    const rows = await db`
      SELECT app, enabled FROM user_app_access
      WHERE org_id = ${orgId} AND user_id = ${userId}
    ` as Array<{ app: string; enabled: boolean }>
    const disabledApps = new Set(rows.filter(r => !r.enabled).map(r => r.app))
    return ALL_APPS.filter(a => !disabledApps.has(a))
  } catch {
    return ALL_APPS
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // getSession returns null for unauthenticated requests (e.g., public signing page)
  // Middleware handles auth redirect for all paths except /sign/*
  const session = await getSession()
  const jar = await cookies()
  const theme = (jar.get('owl_theme')?.value ?? 'light') as 'light' | 'dark' | 'warm'

  let allowedApps: string[] | undefined
  if (session?.userId && session?.orgId) {
    allowedApps = await getAllowedApps(session.userId, session.orgId)
  }

  return (
    <html lang="en" data-theme={theme} className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Dancing+Script&family=Pacifico&family=Great+Vibes&family=Satisfy&family=Caveat&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-bg-base text-fg-primary antialiased flex flex-col min-h-screen">
        {session && (
          <TopNav session={session} activeApp="pdf" orgSlug={session.orgSlug ?? undefined} theme={theme} allowedApps={allowedApps} />
        )}
        <main className={`flex-1 ${session ? '' : 'pt-0'}`}>{children}</main>
      </body>
    </html>
  )
}
