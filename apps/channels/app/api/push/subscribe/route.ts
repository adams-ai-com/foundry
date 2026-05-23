import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId || !session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscription } = await req.json() as {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
  }
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const ua = req.headers.get('user-agent')?.slice(0, 200) ?? null

  await db`
    INSERT INTO push_subscriptions (org_id, user_id, endpoint, p256dh, auth, user_agent)
    VALUES (${session.orgId}, ${session.userId},
            ${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth}, ${ua})
    ON CONFLICT (user_id, endpoint) DO UPDATE
      SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent
  `

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await req.json() as { endpoint: string }
  if (!endpoint) return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })

  await db`DELETE FROM push_subscriptions WHERE user_id = ${session.userId} AND endpoint = ${endpoint}`
  return NextResponse.json({ ok: true })
}
