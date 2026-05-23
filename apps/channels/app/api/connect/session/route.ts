import { NextRequest, NextResponse } from 'next/server'
import { getGuestSession } from '@/lib/guest-auth'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const guest = await getGuestSession()
  if (!guest) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(guest)
}
