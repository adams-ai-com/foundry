import { NextResponse } from 'next/server'
import { vapidPublicKey } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function GET() {
  const key = vapidPublicKey()
  if (!key) return NextResponse.json({ error: 'Push not configured' }, { status: 503 })
  return NextResponse.json({ publicKey: key })
}
