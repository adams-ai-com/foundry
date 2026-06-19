import { NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ authed: false }, { status: 401 })
  return NextResponse.json({ authed: true, email: session.email, name: session.name })
}
