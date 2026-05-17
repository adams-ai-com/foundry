import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Foundry Docs',
  description: 'Word processor — part of the Foundry suite',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  )
}
