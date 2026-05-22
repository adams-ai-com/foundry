import type { Metadata } from 'next'
import './globals.css'
import { requireSession } from '@foundry/auth'
import { TopNav } from '@foundry/ui'

export const metadata: Metadata = {
  title: 'Foundry Sheets',
  description: 'Spreadsheets — part of the Foundry suite',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()

  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased flex flex-col min-h-screen">
        <TopNav session={session} activeApp="sheets" orgSlug={session.orgSlug ?? undefined} />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}

