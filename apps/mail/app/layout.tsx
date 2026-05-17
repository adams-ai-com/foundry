import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Foundry Mail',
  description: 'Email and calendar — part of the Foundry suite',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased overflow-hidden">{children}</body>
    </html>
  )
}
