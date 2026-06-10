import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { generatePkce, buildAuthUrl, isMsConfigured } from '@/lib/auth-microsoft'

export async function GET() {
  if (!isMsConfigured()) {
    return NextResponse.redirect(new URL('/login?err=ms_not_configured', process.env.APP_URL ?? 'https://foundry.adams-ai.com'))
  }

  const state = randomBytes(16).toString('hex')
  const { verifier, challenge } = generatePkce()

  const jar = await cookies()
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 600 }
  jar.set('ms_auth_state', state, opts)
  jar.set('ms_code_verifier', verifier, opts)

  return NextResponse.redirect(buildAuthUrl(state, challenge))
}
