import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { requireSession } from '@owl/auth'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'OWL Mail',
  description: 'Email and calendar — part of OpenWork Loft',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await requireSession()
  const cookieStore = await cookies()
  const theme = cookieStore.get('owl_theme')?.value ?? 'light'

  return (
    <html lang="en" data-theme={theme} className={inter.variable}>
      <body className="bg-bg-base text-fg-primary antialiased overflow-hidden">{children}</body>
    </html>
  )
}
