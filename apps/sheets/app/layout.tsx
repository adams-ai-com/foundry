import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { requireSession } from '@owl/auth'
import { TopNav } from '@owl/ui'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'OWL Sheets',
  description: 'Spreadsheets — part of OpenWork Loft',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const cookieStore = await cookies()
  const theme = (cookieStore.get('owl_theme')?.value ?? 'light') as 'light' | 'dark' | 'warm'

  return (
    <html lang="en" data-theme={theme} className={inter.variable}>
      <body className="bg-bg-base text-fg-primary antialiased flex flex-col min-h-screen">
        <TopNav session={session} activeApp="sheets" orgSlug={session.orgSlug ?? undefined} theme={theme} />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
