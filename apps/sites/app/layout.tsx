import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { requireSession } from '@foundry/auth'
import { TopNav } from '@foundry/ui'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'Foundry Sites',
  description: 'Team sites with folders and permissions — part of the Foundry suite',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const cookieStore = await cookies()
  const theme = (cookieStore.get('foundry_theme')?.value ?? 'light') as 'light' | 'dark' | 'warm'

  return (
    <html lang="en" data-theme={theme} className={inter.variable}>
      <body className="bg-bg-base text-fg-primary antialiased flex flex-col min-h-screen">
        <TopNav session={session} activeApp="sites" orgSlug={session.orgSlug ?? undefined} theme={theme} />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  )
}
