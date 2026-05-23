import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { FeedbackButton } from '@/components/FeedbackButton'
import { requireSession } from '@foundry/auth'
import { TopNav } from '@foundry/ui'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'Foundry Docs',
  description: 'Word processor — part of the Foundry suite',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const jar = await cookies()
  const theme = (jar.get('foundry_theme')?.value ?? 'light') as 'light' | 'dark' | 'warm'

  return (
    <html lang="en" data-theme={theme} className={inter.variable}>
      <body className="antialiased flex flex-col min-h-screen">
        <TopNav session={session} activeApp="docs" orgSlug={session.orgSlug ?? undefined} theme={theme} />
        <main className="flex-1">{children}</main>
        <FeedbackButton />
      </body>
    </html>
  )
}
