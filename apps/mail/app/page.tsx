import { cookies } from 'next/headers'
import { MailShell } from '@/components/MailShell'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const cookieStore = await cookies()
  const theme = (cookieStore.get('foundry_theme')?.value ?? 'light') as 'light' | 'dark' | 'warm'
  return <MailShell defaultTheme={theme} />
}
