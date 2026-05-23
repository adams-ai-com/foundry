'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import db from './db'
import { createSession, setSessionCookie, destroySession, clearSessionCookie, getSession, requireAdmin } from './auth'
import { generateSecret, verifyCode } from './totp'
import { sendInvite } from './mailer'
import { writeAudit } from './audit'

const ALLOWLIST = new Set(['john@adams-ai.com'])
const EMAIL_COOKIE = 'foundry_login_email'
const PENDING_SECRET_COOKIE = 'foundry_totp_pending'
const INVITE_TOKEN_COOKIE = 'foundry_invite'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export async function submitEmail(formData: FormData) {
  const email = (formData.get('email') as string ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) return { error: 'Valid email required' }

  if (!ALLOWLIST.has(email)) {
    const rows = await db`
      SELECT u.id FROM users u
      JOIN org_members m ON m.user_id = u.id
      WHERE u.email = ${email}
      LIMIT 1
    `
    if (!rows.length) {
      await writeAudit({ orgId: null, actorEmail: email, action: 'auth.sign_in_failed', metadata: { reason: 'not_allowed' } })
      return { error: 'Access denied' }
    }
  }

  const jar = await cookies()
  jar.set(EMAIL_COOKIE, email, { ...COOKIE_OPTS, maxAge: 10 * 60 })
  redirect('/login/verify')
}

export async function verifyTotp(formData: FormData) {
  const jar = await cookies()
  const email = jar.get(EMAIL_COOKIE)?.value
  if (!email) redirect('/login')

  const code = (formData.get('code') as string ?? '').replace(/\s/g, '')
  if (!code || code.length !== 6) return { error: 'Enter the 6-digit code' }

  const rows = await db`SELECT id, totp_secret, deactivated_at FROM users WHERE email = ${email}`
  if (!rows.length || !rows[0].totp_secret) redirect('/login/setup')

  const user = rows[0]
  if (user.deactivated_at) {
    const orgRows = await db`SELECT org_id FROM org_members WHERE user_id = ${user.id} LIMIT 1`
    await writeAudit({ orgId: (orgRows[0]?.org_id ?? null) as string | null, actorId: user.id as string, actorEmail: email, action: 'auth.sign_in_failed', metadata: { reason: 'deactivated' } })
    return { error: 'This account has been deactivated. Contact your administrator.' }
  }
  if (!verifyCode(user.totp_secret as string, code)) {
    const orgRows = await db`SELECT org_id FROM org_members WHERE user_id = ${user.id} LIMIT 1`
    await writeAudit({ orgId: (orgRows[0]?.org_id ?? null) as string | null, actorId: user.id as string, actorEmail: email, action: 'auth.sign_in_failed', metadata: { reason: 'bad_totp' } })
    return { error: 'Invalid code — try again' }
  }

  jar.delete(EMAIL_COOKIE)

  const memberRows = await db`
    SELECT org_id FROM org_members WHERE user_id = ${user.id} ORDER BY joined_at ASC LIMIT 1
  `
  let orgId = (memberRows[0]?.org_id ?? null) as string | null

  const inviteToken = jar.get(INVITE_TOKEN_COOKIE)?.value
  if (inviteToken) {
    orgId = await acceptInvite(user.id as string, inviteToken, jar) ?? orgId
  }

  const sessionId = await createSession(user.id as string, orgId)
  await setSessionCookie(sessionId)
  await writeAudit({ orgId, actorId: user.id as string, actorEmail: user.email as string, action: 'auth.sign_in' })

  const returnTo = jar.get('foundry_return_to')?.value
  jar.delete('foundry_return_to')
  redirect(returnTo && returnTo.startsWith('/') ? returnTo : '/')
}

export async function startSetup(_formData: FormData) {
  const jar = await cookies()
  const email = jar.get(EMAIL_COOKIE)?.value
  if (!email) redirect('/login')

  const secret = generateSecret()
  jar.set(PENDING_SECRET_COOKIE, secret, { ...COOKIE_OPTS, maxAge: 10 * 60 })
  redirect('/login/setup')
}

export async function confirmTotpSetup(formData: FormData) {
  const jar = await cookies()
  const email = jar.get(EMAIL_COOKIE)?.value
  const secret = jar.get(PENDING_SECRET_COOKIE)?.value
  if (!email || !secret) redirect('/login')

  const code = (formData.get('code') as string ?? '').replace(/\s/g, '')
  if (!code || code.length !== 6) return { error: 'Enter the 6-digit code' }
  if (!verifyCode(secret, code)) return { error: 'Code did not match — scan the QR code and retry' }

  const userRows = await db`
    INSERT INTO users (email, totp_secret) VALUES (${email}, ${secret})
    ON CONFLICT (email) DO UPDATE SET totp_secret = ${secret}
    RETURNING id
  `
  const userId = userRows[0].id as string
  jar.delete(EMAIL_COOKIE)
  jar.delete(PENDING_SECRET_COOKIE)

  const memberRows = await db`
    SELECT org_id FROM org_members WHERE user_id = ${userId} ORDER BY joined_at ASC LIMIT 1
  `
  let orgId = (memberRows[0]?.org_id ?? null) as string | null

  const inviteToken = jar.get(INVITE_TOKEN_COOKIE)?.value
  if (inviteToken) {
    orgId = await acceptInvite(userId, inviteToken, jar) ?? orgId
  }

  const sessionId = await createSession(userId, orgId)
  await setSessionCookie(sessionId)
  await writeAudit({ orgId, actorId: userId, actorEmail: email, action: 'auth.totp_setup' })
  redirect('/')
}

async function acceptInvite(
  userId: string,
  token: string,
  jar: Awaited<ReturnType<typeof cookies>>,
): Promise<string | null> {
  const rows = await db`
    SELECT id, org_id, role FROM invites
    WHERE token = ${token}
      AND accepted_at IS NULL
      AND expires_at > NOW()
  `
  if (!rows.length) return null

  const invite = rows[0]
  await db`
    INSERT INTO org_members (org_id, user_id, role)
    VALUES (${invite.org_id}, ${userId}, ${invite.role})
    ON CONFLICT (org_id, user_id) DO NOTHING
  `
  await db`UPDATE invites SET accepted_at = NOW() WHERE id = ${invite.id}`
  jar.delete(INVITE_TOKEN_COOKIE)

  // Apply org's default app access — only write rows for disabled apps
  const disabledDefaults = await db`
    SELECT app FROM org_app_defaults
    WHERE org_id = ${invite.org_id} AND enabled = false
  `
  if (disabledDefaults.length) {
    await Promise.all((disabledDefaults as unknown as Array<{ app: string }>).map(r =>
      db`
        INSERT INTO user_app_access (org_id, user_id, app, enabled)
        VALUES (${invite.org_id}, ${userId}, ${r.app}, false)
        ON CONFLICT (org_id, user_id, app) DO NOTHING
      `
    ))
  }

  return invite.org_id as string
}

export async function beginInviteLogin(token: string): Promise<void> {
  const rows = await db`
    SELECT i.email, i.role, i.token, o.name as org_name
    FROM invites i
    JOIN orgs o ON o.id = i.org_id
    WHERE i.token = ${token}
      AND i.accepted_at IS NULL
      AND i.expires_at > NOW()
  `
  if (!rows.length) redirect('/login')

  const invite = rows[0]
  const jar = await cookies()
  jar.set(EMAIL_COOKIE, invite.email as string, { ...COOKIE_OPTS, maxAge: 60 * 60 })
  jar.set(INVITE_TOKEN_COOKIE, token, { ...COOKIE_OPTS, maxAge: 60 * 60 })

  const userRows = await db`SELECT id, totp_secret FROM users WHERE email = ${invite.email}`
  if (userRows.length && userRows[0].totp_secret) {
    redirect('/login/verify')
  }
  redirect('/login/setup')
}

export async function createInvite(formData: FormData) {
  const session = await requireAdmin()

  const email = (formData.get('email') as string ?? '').trim().toLowerCase()
  const role = (formData.get('role') as string ?? 'member')

  const encErr = (msg: string) => redirect(`/admin/users/invite?err=${encodeURIComponent(msg)}`)

  if (!email || !email.includes('@')) encErr('Valid email required')
  if (!['owner', 'admin', 'member'].includes(role)) encErr('Invalid role')
  if (!session.orgId) encErr('No active organization')

  const existing = await db`SELECT id FROM users WHERE email = ${email}`
  if (existing.length) {
    const member = await db`SELECT id FROM org_members WHERE user_id = ${existing[0].id} AND org_id = ${session.orgId}`
    if (member.length) encErr('This user is already a member of the organization')
  }

  const pending = await db`
    SELECT id FROM invites
    WHERE email = ${email} AND org_id = ${session.orgId}
      AND accepted_at IS NULL AND expires_at > NOW()
  `
  if (pending.length) encErr('An active invite already exists for this email')

  const rows = await db`
    INSERT INTO invites (email, role, org_id, invited_by)
    VALUES (${email}, ${role}, ${session.orgId as string}, ${session.userId})
    RETURNING id, token
  `
  const invite = rows[0]
  const appUrl = (process.env.APP_URL ?? 'https://foundry.adams-ai.com').replace(/\/$/, '')
  const inviteUrl = `${appUrl}/invite/${invite.token}`

  await sendInvite(email, inviteUrl, session.email, role)

  redirect(`/admin/users/invite?created=${invite.id}`)
}

export async function createOrg(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')

  const name = (formData.get('name') as string ?? '').trim()
  if (!name) return { error: 'Name required' }

  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!baseSlug) return { error: 'Invalid name' }

  const existing = await db`SELECT slug FROM orgs WHERE slug LIKE ${baseSlug + '%'}`
  const taken = new Set(existing.map(r => r.slug as string))
  let slug = baseSlug
  let n = 2
  while (taken.has(slug)) slug = `${baseSlug}-${n++}`

  const orgRows = await db`
    INSERT INTO orgs (name, slug) VALUES (${name}, ${slug}) RETURNING id, slug
  `
  const org = orgRows[0]

  await db`INSERT INTO org_members (org_id, user_id, role) VALUES (${org.id}, ${session.userId}, 'owner')`
  await db`UPDATE sessions SET org_id = ${org.id} WHERE id = ${session.sessionId}`

  redirect(`/org/${org.slug}`)
}

export async function logout() {
  const session = await getSession()
  if (session) await destroySession(session.sessionId)
  await clearSessionCookie()
  redirect('/login')
}

export async function setTheme(theme: string) {
  const allowed = ['light', 'dark', 'warm']
  if (!allowed.includes(theme)) return
  const jar = await cookies()
  jar.set('foundry_theme', theme, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
  })
}
