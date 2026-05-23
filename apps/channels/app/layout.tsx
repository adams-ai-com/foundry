import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'Channels — Foundry',
  description: 'Team messaging',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies()
  const theme = jar.get('foundry_theme')?.value ?? 'light'
  return (
    <html lang="en" data-theme={theme} className={inter.variable}>
      <body className="antialiased h-full">{children}</body>
    </html>
  )
}
