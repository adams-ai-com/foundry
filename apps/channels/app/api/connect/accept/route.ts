import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { token, name } = await req.json() as { token: string; name: string }
  if (!token || !name?.trim()) {
    return NextResponse.json({ error: 'Token and name required' }, { status: 400 })
  }

  // Look up and validate invite
  const [invite] = await db`
    SELECT id, org_id, channel_id, topic_id, email, expires_at, used_at
    FROM channel_connect_invites
    WHERE token = ${token} AND expires_at > now()
  `
  if (!invite) return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
  if (invite.used_at) return NextResponse.json({ error: 'Invite already used' }, { status: 410 })

  // Upsert guest account
  await db`
    INSERT INTO channel_connect_guests (org_id, email, name)
    VALUES (${invite.org_id}, ${invite.email}, ${name.trim()})
    ON CONFLICT (org_id, email) DO UPDATE SET name = EXCLUDED.name
  `

  const [guest] = await db`
    SELECT id FROM channel_connect_guests WHERE org_id = ${invite.org_id} AND email = ${invite.email}
  `

  // Grant topic access
  await db`
    INSERT INTO channel_connect_access (guest_id, topic_id, channel_id)
    VALUES (${guest.id}, ${invite.topic_id}, ${invite.channel_id})
    ON CONFLICT (guest_id, topic_id) DO UPDATE SET revoked_at = NULL, granted_at = now()
  `

  // Mark invite used
  await db`
    UPDATE channel_connect_invites SET used_at = now() WHERE id = ${invite.id}
  `

  // Create session token (30 days)
  const sessionToken = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await db`
    INSERT INTO channel_connect_sessions (guest_id, token, expires_at)
    VALUES (${guest.id}, ${sessionToken}, ${expiresAt})
  `

  const res = NextResponse.json({
    ok: true,
    channelId: invite.channel_id,
    topicId:   invite.topic_id,
  })

  res.cookies.set('foundry_connect_token', sessionToken, {
    httpOnly: true,
    path:     '/',
    expires:  expiresAt,
    sameSite: 'lax',
  })

  return res
}
