'use server'

import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import db from './db'
import { createSession, setSessionCookie, destroySession, clearSessionCookie, getSession, requireAdmin } from './auth'
import { sendInvite, sendSecurityAlert, sendEmailOTP } from './mailer'
import { writeAudit } from './audit'

const ALLOWLIST = new Set(['john@adams-ai.com'])
const EMAIL_COOKIE = 'foundry_login_email'
const OTP_CHALLENGE_COOKIE = 'foundry_otp_challenge'
const INVITE_TOKEN_COOKIE = 'foundry_invite'
const OTP_MAX_ATTEMPTS = 5
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

async function getRequestMeta(): Promise<{ ip: string | null; ua: string | null }> {
  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? hdrs.get('x-real-ip')
    ?? null
  const ua = hdrs.get('user-agent') ?? null
  return { ip, ua }
}

export async function submitEmail(formData: FormData) {
  const email = (formData.get('email') as string ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) return { error: 'Valid email required' }

  // Must have an account with org membership, unless explicitly allowlisted
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
  redirect('/login/password')
}

export async function passwordLogin(formData: FormData) {
  const jar = await cookies()
  const email = jar.get(EMAIL_COOKIE)?.value
  if (!email) redirect('/login')

  const password = (formData.get('password') as string ?? '').trim()
  if (!password) return { error: 'Password required' }

  const rows = await db`
    SELECT id, password_hash, deactivated_at FROM users WHERE email = ${email}
  `
  if (!rows.length || !rows[0].password_hash) {
    await writeAudit({ orgId: null, actorEmail: email, action: 'auth.sign_in_failed', metadata: { reason: 'no_password' } })
    return { error: 'No password set for this account. Contact your administrator.' }
  }

  const user = rows[0]

  if (user.deactivated_at) {
    const orgRows = await db`SELECT org_id FROM org_members WHERE user_id = ${user.id} LIMIT 1`
    await writeAudit({ orgId: (orgRows[0]?.org_id ?? null) as string | null, actorId: user.id as string, actorEmail: email, action: 'auth.sign_in_failed', metadata: { reason: 'deactivated' } })
    return { error: 'This account has been deactivated. Contact your administrator.' }
  }

  const { pbkdf2Sync } = await import('crypto')
  const stored = user.password_hash as string
  const parts = stored.split(':')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    return { error: 'Invalid credentials' }
  }
  const [, iterStr, salt, expectedHash] = parts
  const actual = pbkdf2Sync(password, salt, parseInt(iterStr, 10), 64, 'sha512').toString('base64')
  if (actual !== expectedHash) {
    const orgRows = await db`SELECT org_id FROM org_members WHERE user_id = ${user.id} LIMIT 1`
    await writeAudit({ orgId: (orgRows[0]?.org_id ?? null) as string | null, actorId: user.id as string, actorEmail: email, action: 'auth.sign_in_failed', metadata: { reason: 'bad_password' } })
    return { error: 'Invalid credentials' }
  }

  // Password verified — issue an emailed OTP as second factor
  const { randomInt, randomBytes, createHash } = await import('crypto')
  const code = String(randomInt(0, 1000000)).padStart(6, '0')
  const salt = randomBytes(16).toString('hex')
  const codeHash = createHash('sha256').update(code + salt).digest('hex')

  const challengeRows = await db`
    INSERT INTO email_otp_challenges (user_id, code_hash, salt)
    VALUES (${user.id as string}, ${codeHash}, ${salt})
    RETURNING id
  `
  const challengeId = challengeRows[0].id as string

  await sendEmailOTP(email, code)

  jar.set(OTP_CHALLENGE_COOKIE, challengeId, { ...COOKIE_OPTS, maxAge: 10 * 60 })
  redirect('/login/verify')
}

export async function verifyEmailCode(formData: FormData) {
  const jar = await cookies()
  const email = jar.get(EMAIL_COOKIE)?.value
  const challengeId = jar.get(OTP_CHALLENGE_COOKIE)?.value
  if (!email || !challengeId) redirect('/login')

  const code = (formData.get('code') as string ?? '').replace(/\s/g, '')
  if (!code || code.length !== 6) return { error: 'Enter the 6-digit code' }

  const rows = await db`
    SELECT id, user_id, code_hash, salt, attempts, expires_at, used_at
    FROM email_otp_challenges
    WHERE id = ${challengeId}
    LIMIT 1
  `
  if (!rows.length) return { error: 'Code expired. Please sign in again.' }
  const challenge = rows[0]

  if (challenge.used_at) return { error: 'Code already used. Please sign in again.' }

  if (new Date(challenge.expires_at as string) < new Date()) {
    await db`DELETE FROM email_otp_challenges WHERE id = ${challengeId}`
    return { error: 'Code expired. Please sign in again.' }
  }

  if ((challenge.attempts as number) >= OTP_MAX_ATTEMPTS) {
    await db`DELETE FROM email_otp_challenges WHERE id = ${challengeId}`
    return { error: 'Too many attempts. Please sign in again.' }
  }

  const { createHash } = await import('crypto')
  const expectedHash = createHash('sha256').update(code + (challenge.salt as string)).digest('hex')

  if (expectedHash !== challenge.code_hash) {
    const newAttempts = (challenge.attempts as number) + 1
    await db`UPDATE email_otp_challenges SET attempts = ${newAttempts} WHERE id = ${challengeId}`
    const remaining = OTP_MAX_ATTEMPTS - newAttempts
    if (remaining <= 0) {
      await db`DELETE FROM email_otp_challenges WHERE id = ${challengeId}`
      return { error: 'Too many attempts. Please sign in again.' }
    }
    return { error: `Invalid code — ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` }
  }

  await db`UPDATE email_otp_challenges SET used_at = NOW() WHERE id = ${challengeId}`
  jar.delete(OTP_CHALLENGE_COOKIE)
  jar.delete(EMAIL_COOKIE)

  const userId = challenge.user_id as string
  const memberRows = await db`
    SELECT org_id FROM org_members WHERE user_id = ${userId} ORDER BY joined_at ASC LIMIT 1
  `
  let orgId = (memberRows[0]?.org_id ?? null) as string | null

  const inviteToken = jar.get(INVITE_TOKEN_COOKIE)?.value
  if (inviteToken) {
    orgId = await acceptInvite(userId, inviteToken, jar) ?? orgId
  }

  const { ip, ua } = await getRequestMeta()
  const { sessionId, timeoutHours } = await createSession(userId, orgId, { ip, ua })
  await setSessionCookie(sessionId, timeoutHours)
  await writeAudit({ orgId, actorId: userId, actorEmail: email, action: 'auth.sign_in', metadata: { method: 'email_otp' } })

  const mustReset = await db`SELECT must_reset_password FROM users WHERE id = ${userId}`
  if (mustReset[0]?.must_reset_password) {
    redirect('/login/reset-password')
  }

  const returnTo = jar.get('foundry_return_to')?.value
  jar.delete('foundry_return_to')
  redirect(returnTo && returnTo.startsWith('/') ? returnTo : '/')
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

  redirect('/login/password')
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

  await writeAudit({ orgId: session.orgId!, actorId: session.userId, actorEmail: session.email, action: 'user.invite', targetEmail: email, metadata: { role } })
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

export async function resetPassword(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')

  const password = (formData.get('password') as string ?? '').trim()
  if (!password || password.length < 8) return { error: 'Password must be at least 8 characters' }

  const { pbkdf2Sync, randomBytes } = await import('crypto')
  const salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('base64')
  const passwordHash = `pbkdf2:100000:${salt}:${hash}`

  await db`
    UPDATE users SET password_hash = ${passwordHash}, must_reset_password = false
    WHERE id = ${session.userId}
  `
  await writeAudit({ orgId: session.orgId, actorId: session.userId, actorEmail: session.email, action: 'auth.password_reset', metadata: {} })
  redirect('/')
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
