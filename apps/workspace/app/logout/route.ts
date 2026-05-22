import { NextResponse } from 'next/server'
import { getSession, destroySession } from '@/lib/auth'
import { clearSessionCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (session) await destroySession(session.sessionId)
  await clearSessionCookie()
  const base = process.env.APP_URL ?? ''
  return NextResponse.redirect(`${base}/login`)
}
