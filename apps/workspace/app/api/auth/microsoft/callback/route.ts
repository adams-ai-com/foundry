import { NextRequest, NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { exchangeCode } from '@/lib/auth-microsoft'
import { createSession, setSessionCookie } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'
import db from '@/lib/db'

const MS_DOMAIN = 'adams-ai.com'
const APP_URL = () => (process.env.APP_URL ?? 'https://foundry.adams-ai.com').replace(/\/$/, '')

function loginErr(code: string): NextResponse {
  return NextResponse.redirect(`${APP_URL()}/login?err=${encodeURIComponent(code)}`)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const msError = searchParams.get('error')

  if (msError) return loginErr(msError)

  const jar = await cookies()
  const savedState = jar.get('ms_auth_state')?.value
  const codeVerifier = jar.get('ms_code_verifier')?.value

  jar.delete('ms_auth_state')
  jar.delete('ms_code_verifier')

  if (!code || !state || !savedState || state !== savedState || !codeVerifier) {
    return loginErr('auth_failed')
  }

  try {
    const { oid, email, name } = await exchangeCode(code, codeVerifier)

    if (!email.endsWith(`@${MS_DOMAIN}`)) {
      return loginErr('domain_not_allowed')
    }

    // Upsert user — create on first MS login, update name/oid on subsequent
    const userRows = await db`
      INSERT INTO users (email, name, ms_oid)
      VALUES (${email}, ${name || null}, ${oid})
      ON CONFLICT (email) DO UPDATE
        SET ms_oid = EXCLUDED.ms_oid,
            name   = COALESCE(EXCLUDED.name, users.name)
      RETURNING id, deactivated_at
    `
    const user = userRows[0] as { id: string; deactivated_at: string | null }

    if (user.deactivated_at) {
      await writeAudit({ orgId: null, actorId: user.id, actorEmail: email, action: 'auth.sign_in_failed', metadata: { reason: 'deactivated', method: 'microsoft' } })
      return loginErr('account_deactivated')
    }

    const memberRows = await db`
      SELECT org_id FROM org_members WHERE user_id = ${user.id} ORDER BY joined_at ASC LIMIT 1
    `
    let orgId = (memberRows[0]?.org_id ?? null) as string | null

    // Accept pending invite if one was stored before MS redirect
    const inviteToken = jar.get('foundry_invite')?.value
    if (inviteToken) {
      const invRows = await db`
        SELECT id, org_id, role FROM invites
        WHERE token = ${inviteToken} AND accepted_at IS NULL AND expires_at > NOW()
      `
      if (invRows.length) {
        const inv = invRows[0]
        await db`
          INSERT INTO org_members (org_id, user_id, role)
          VALUES (${inv.org_id}, ${user.id}, ${inv.role})
          ON CONFLICT (org_id, user_id) DO NOTHING
        `
        await db`UPDATE invites SET accepted_at = NOW() WHERE id = ${inv.id}`
        orgId = inv.org_id as string
        jar.delete('foundry_invite')
      }
    }

    const hdrs = await headers()
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null
    const ua = hdrs.get('user-agent') ?? null
    const { sessionId, timeoutHours } = await createSession(user.id, orgId, { ip, ua })
    await setSessionCookie(sessionId, timeoutHours)
    await writeAudit({ orgId, actorId: user.id, actorEmail: email, action: 'auth.sign_in', metadata: { method: 'microsoft' } })

    const returnTo = jar.get('foundry_return_to')?.value
    jar.delete('foundry_return_to')
    const dest = returnTo && returnTo.startsWith('/') ? returnTo : '/'
    return NextResponse.redirect(`${APP_URL()}${dest}`)
  } catch (err) {
    console.error('[MS auth callback]', err)
    return loginErr('auth_failed')
  }
}
