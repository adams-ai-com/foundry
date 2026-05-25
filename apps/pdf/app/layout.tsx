import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { requireSession } from '@foundry/auth'
import { TopNav } from '@foundry/ui'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'Foundry PDF',
  description: 'PDF editing, forms, conversion, and redaction — part of the Foundry suite',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const jar = await cookies()
  const theme = (jar.get('foundry_theme')?.value ?? 'light') as 'light' | 'dark' | 'warm'

  return (
    <html lang="en" data-theme={theme} className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Dancing+Script&family=Pacifico&family=Great+Vibes&family=Satisfy&family=Caveat&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-bg-base text-fg-primary antialiased flex flex-col min-h-screen">
        <TopNav session={session} activeApp="pdf" orgSlug={session.orgSlug ?? undefined} theme={theme} />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
