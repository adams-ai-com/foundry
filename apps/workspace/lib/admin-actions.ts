'use server'

import { redirect } from 'next/navigation'
import db from './db'
import { requireAdmin } from './auth'
import { writeAudit } from './audit'

type OrgUser = { role: string; deactivated_at: string | null; email: string }

async function getOrgUser(orgId: string, userId: string): Promise<OrgUser | null> {
  const rows = await db`
    SELECT m.role, u.deactivated_at, u.email
    FROM org_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.org_id = ${orgId} AND m.user_id = ${userId}
  `
  return rows.length ? rows[0] as OrgUser : null
}

function canActOn(actorRole: string, targetRole: string): boolean {
  if (actorRole === 'owner') return true
  if (actorRole === 'admin') return targetRole === 'member'
  return false
}

export async function deactivateUser(userId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()
  if (userId === session.userId) redirect(`/admin/users/${userId}?err=Cannot+deactivate+your+own+account`)

  const target = await getOrgUser(session.orgId!, userId)
  if (!target) redirect(`/admin/users/${userId}?err=User+not+found+in+this+organization`)
  if (!canActOn(session.role!, target.role)) redirect(`/admin/users/${userId}?err=Insufficient+permissions+to+deactivate+this+user`)
  if (target.deactivated_at) redirect(`/admin/users/${userId}?err=User+is+already+deactivated`)

  await db`UPDATE users SET deactivated_at = NOW() WHERE id = ${userId} AND EXISTS (SELECT 1 FROM org_members WHERE user_id = ${userId} AND org_id = ${session.orgId!})`
  await db`DELETE FROM sessions WHERE user_id = ${userId}`
  await writeAudit({ orgId: session.orgId!, actorId: session.userId, actorEmail: session.email, action: 'user.deactivate', targetId: userId, targetEmail: target.email })

  redirect(`/admin/users/${userId}?msg=User+deactivated+and+signed+out+of+all+sessions`)
}

export async function reactivateUser(userId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()

  const target = await getOrgUser(session.orgId!, userId)
  if (!target) redirect(`/admin/users/${userId}?err=User+not+found+in+this+organization`)
  if (!canActOn(session.role!, target.role)) redirect(`/admin/users/${userId}?err=Insufficient+permissions+to+reactivate+this+user`)
  if (!target.deactivated_at) redirect(`/admin/users/${userId}?err=User+is+not+deactivated`)

  await db`UPDATE users SET deactivated_at = NULL WHERE id = ${userId} AND EXISTS (SELECT 1 FROM org_members WHERE user_id = ${userId} AND org_id = ${session.orgId!})`
  await writeAudit({ orgId: session.orgId!, actorId: session.userId, actorEmail: session.email, action: 'user.reactivate', targetId: userId, targetEmail: target.email })

  redirect(`/admin/users/${userId}?msg=User+reactivated`)
}

export async function removeFromOrg(userId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()
  if (userId === session.userId) redirect(`/admin/users/${userId}?err=Cannot+remove+yourself+from+the+organization`)

  const target = await getOrgUser(session.orgId!, userId)
  if (!target) redirect(`/admin/users/${userId}?err=User+not+found+in+this+organization`)
  if (!canActOn(session.role!, target.role)) redirect(`/admin/users/${userId}?err=Insufficient+permissions+to+remove+this+user`)

  await db`DELETE FROM org_members WHERE user_id = ${userId} AND org_id = ${session.orgId}`
  await db`UPDATE sessions SET org_id = NULL WHERE user_id = ${userId} AND org_id = ${session.orgId}`
  await writeAudit({ orgId: session.orgId!, actorId: session.userId, actorEmail: session.email, action: 'user.remove', targetId: userId, targetEmail: target.email })

  redirect(`/admin/users?msg=User+removed+from+organization`)
}

export async function resetTotp(userId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()

  const target = await getOrgUser(session.orgId!, userId)
  if (!target) redirect(`/admin/users/${userId}?err=User+not+found+in+this+organization`)
  if (!canActOn(session.role!, target.role)) redirect(`/admin/users/${userId}?err=Insufficient+permissions+to+reset+TOTP+for+this+user`)

  const rows = await db`SELECT totp_secret FROM users WHERE id = ${userId}`
  if (!rows.length || !rows[0].totp_secret) redirect(`/admin/users/${userId}?err=User+has+no+TOTP+enrolled`)

  await db`UPDATE users SET totp_secret = NULL, totp_failed_count = 0, totp_locked_until = NULL WHERE id = ${userId} AND EXISTS (SELECT 1 FROM org_members WHERE user_id = ${userId} AND org_id = ${session.orgId!})`
  await db`DELETE FROM sessions WHERE user_id = ${userId}`
  await writeAudit({ orgId: session.orgId!, actorId: session.userId, actorEmail: session.email, action: 'user.totp_reset', targetId: userId, targetEmail: target.email })

  redirect(`/admin/users/${userId}?msg=TOTP+reset.+User+will+re-enroll+on+next+login.`)
}

export async function changeRole(userId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()

  if (session.role !== 'owner') redirect(`/admin/users/${userId}?err=Only+owners+can+change+roles`)
  if (userId === session.userId) redirect(`/admin/users/${userId}?err=Cannot+change+your+own+role`)

  const newRole = (formData.get('role') as string ?? '').trim()
  if (!['owner', 'admin', 'member'].includes(newRole)) redirect(`/admin/users/${userId}?err=Invalid+role`)

  const target = await getOrgUser(session.orgId!, userId)
  if (!target) redirect(`/admin/users/${userId}?err=User+not+found+in+this+organization`)
  if (target.role === newRole) redirect(`/admin/users/${userId}?msg=No+change+—+already+${newRole}`)

  await db`UPDATE org_members SET role = ${newRole} WHERE user_id = ${userId} AND org_id = ${session.orgId}`
  await writeAudit({ orgId: session.orgId!, actorId: session.userId, actorEmail: session.email, action: 'user.role_change', targetId: userId, targetEmail: target.email, metadata: { from: target.role, to: newRole } })

  const label = newRole.charAt(0).toUpperCase() + newRole.slice(1)
  redirect(`/admin/users/${userId}?msg=Role+changed+to+${label}`)
}

export async function updateOrgProfile(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  if (!session.orgId) redirect('/admin/org?err=No+active+organization')

  const name = (formData.get('name') as string ?? '').trim()
  const logoUrl = (formData.get('logo_url') as string ?? '').trim()
  const timezone = (formData.get('timezone') as string ?? '').trim()
  const contactEmail = (formData.get('contact_email') as string ?? '').trim().toLowerCase()

  if (!name) redirect('/admin/org?err=Organization+name+is+required')
  if (logoUrl && !logoUrl.startsWith('http')) redirect('/admin/org?err=Logo+URL+must+start+with+http')
  if (contactEmail && !contactEmail.includes('@')) redirect('/admin/org?err=Invalid+contact+email')
  if (!timezone) redirect('/admin/org?err=Timezone+is+required')

  await db`
    UPDATE orgs SET
      name        = ${name},
      logo_url    = ${logoUrl || null},
      timezone    = ${timezone},
      contact_email = ${contactEmail || null}
    WHERE id = ${session.orgId}
  `

  await writeAudit({ orgId: session.orgId!, actorId: session.userId, actorEmail: session.email, action: 'org.profile_update', metadata: { name } })
  redirect('/admin/org?msg=Settings+saved')
}

export async function updateSecurityPolicy(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  if (!session.orgId) redirect('/admin/security')

  const requireTotp = formData.get('require_totp') === 'on'
  const timeoutHoursRaw = parseInt(formData.get('session_timeout_hours') as string ?? '720', 10)
  const maxSessionsRaw = parseInt(formData.get('max_sessions') as string ?? '10', 10)

  const validTimeouts = [4, 8, 24, 168, 720, 2160]
  const timeoutHours = validTimeouts.includes(timeoutHoursRaw) ? timeoutHoursRaw : 720
  const maxSessions = Math.max(1, Math.min(50, isNaN(maxSessionsRaw) ? 10 : maxSessionsRaw))

  await db`
    UPDATE orgs SET
      require_totp          = ${requireTotp},
      session_timeout_hours = ${timeoutHours},
      max_sessions          = ${maxSessions}
    WHERE id = ${session.orgId}
  `

  await writeAudit({ orgId: session.orgId!, actorId: session.userId, actorEmail: session.email, action: 'org.security_update', metadata: { requireTotp, timeoutHours, maxSessions } })
  redirect('/admin/security?msg=Security+settings+saved')
}

export async function addDomain(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  if (!session.orgId) redirect('/admin/domains')

  const raw = (formData.get('domain') as string ?? '').trim().toLowerCase()
  const domain = raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    redirect('/admin/domains?err=Invalid+domain+name')
  }

  const existing = await db`SELECT id FROM domains WHERE domain = ${domain}`
  if (existing.length) redirect('/admin/domains?err=Domain+already+registered')

  await db`
    INSERT INTO domains (org_id, domain) VALUES (${session.orgId}, ${domain})
  `
  await writeAudit({ orgId: session.orgId!, actorId: session.userId, actorEmail: session.email, action: 'domain.add', metadata: { domain } })
  redirect(`/admin/domains?msg=Domain+${encodeURIComponent(domain)}+added.+Add+the+TXT+record+shown+below+then+click+Verify.`)
}

export async function verifyDomain(domainId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()

  const rows = await db`
    SELECT id, domain, verification_token, verified_at
    FROM domains WHERE id = ${domainId} AND org_id = ${session.orgId!}
  `
  if (!rows.length) redirect('/admin/domains?err=Domain+not+found')
  const row = rows[0] as { id: string; domain: string; verification_token: string; verified_at: string | null }

  if (row.verified_at) redirect(`/admin/domains?msg=Domain+already+verified`)

  // DNS TXT lookup
  const { resolveTxt } = await import('dns/promises')
  let verified = false
  try {
    const records = await resolveTxt(`_foundry-verify.${row.domain}`)
    const needle = `foundry-verify=${row.verification_token}`
    verified = records.some(r => r.join('').includes(needle))
  } catch {
    // DNS lookup failed — not yet propagated
  }

  if (!verified) {
    redirect(`/admin/domains?err=TXT+record+not+found+for+${encodeURIComponent(row.domain)}+—+DNS+may+take+up+to+48h+to+propagate`)
  }

  await db`UPDATE domains SET verified_at = NOW() WHERE id = ${domainId}`
  await writeAudit({ orgId: session.orgId!, actorId: session.userId, actorEmail: session.email, action: 'domain.verify', metadata: { domain: row.domain } })
  redirect(`/admin/domains?msg=${encodeURIComponent(row.domain)}+verified+successfully`)
}

export async function removeDomain(domainId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()
  const domRows = await db`SELECT domain FROM domains WHERE id = ${domainId} AND org_id = ${session.orgId!}`
  await db`DELETE FROM domains WHERE id = ${domainId} AND org_id = ${session.orgId!}`
  if (domRows.length) await writeAudit({ orgId: session.orgId!, actorId: session.userId, actorEmail: session.email, action: 'domain.remove', metadata: { domain: domRows[0].domain } })
  redirect('/admin/domains?msg=Domain+removed')
}

// ── DKIM / SPF / DMARC ────────────────────────────────────────────────────────

export async function generateDkimKeys(domainId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()

  const rows = await db`SELECT id, domain FROM domains WHERE id = ${domainId} AND org_id = ${session.orgId!}`
  if (!rows.length) redirect(`/admin/domains/${domainId}?err=Domain+not+found`)

  const { generateKeyPairSync } = await import('crypto')
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  await db`
    INSERT INTO domain_email_config (domain_id, dkim_private_key, dkim_public_key)
    VALUES (${domainId}, ${privateKey}, ${publicKey})
    ON CONFLICT (domain_id) DO UPDATE
      SET dkim_private_key = EXCLUDED.dkim_private_key,
          dkim_public_key  = EXCLUDED.dkim_public_key,
          updated_at       = NOW()
  `
  await writeAudit({ orgId: session.orgId!, actorId: session.userId, actorEmail: session.email, action: 'domain.dkim_generate', metadata: { domain: rows[0].domain } })
  redirect(`/admin/domains/${domainId}?msg=DKIM+keys+generated`)
}

export async function updateDmarcPolicy(domainId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const rows = await db`SELECT id FROM domains WHERE id = ${domainId} AND org_id = ${session.orgId!}`
  if (!rows.length) redirect(`/admin/domains/${domainId}?err=Domain+not+found`)

  const policy = formData.get('dmarc_policy') as string
  if (!['none', 'quarantine', 'reject'].includes(policy)) {
    redirect(`/admin/domains/${domainId}?err=Invalid+DMARC+policy`)
  }

  await db`
    INSERT INTO domain_email_config (domain_id, dmarc_policy)
    VALUES (${domainId}, ${policy})
    ON CONFLICT (domain_id) DO UPDATE
      SET dmarc_policy = EXCLUDED.dmarc_policy,
          updated_at   = NOW()
  `
  await writeAudit({ orgId: session.orgId!, actorId: session.userId, actorEmail: session.email, action: 'domain.dmarc_update', metadata: { domainId, policy } })
  redirect(`/admin/domains/${domainId}?msg=DMARC+policy+saved`)
}

export async function checkEmailDns(domainId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()

  const rows = await db`
    SELECT d.domain, ec.dkim_selector, ec.dkim_public_key
    FROM domains d
    LEFT JOIN domain_email_config ec ON ec.domain_id = d.id
    WHERE d.id = ${domainId} AND d.org_id = ${session.orgId!}
  `
  if (!rows.length) redirect(`/admin/domains/${domainId}?err=Domain+not+found`)
  const row = rows[0] as { domain: string; dkim_selector: string | null; dkim_public_key: string | null }

  const { resolveTxt } = await import('dns/promises')
  const results: string[] = []
  const errors: string[] = []

  // SPF check
  try {
    const spfRecords = await resolveTxt(row.domain)
    const hasSpf = spfRecords.some(r => r.join('').startsWith('v=spf1'))
    if (hasSpf) results.push('SPF')
    else errors.push('SPF record missing')
  } catch { errors.push('SPF lookup failed') }

  // DKIM check
  if (row.dkim_public_key && row.dkim_selector) {
    try {
      const dkimRecords = await resolveTxt(`${row.dkim_selector}._domainkey.${row.domain}`)
      const hasDkim = dkimRecords.some(r => r.join('').includes('v=DKIM1'))
      if (hasDkim) results.push('DKIM')
      else errors.push('DKIM record missing')
    } catch { errors.push('DKIM lookup failed') }
  }

  // DMARC check
  try {
    const dmarcRecords = await resolveTxt(`_dmarc.${row.domain}`)
    const hasDmarc = dmarcRecords.some(r => r.join('').startsWith('v=DMARC1'))
    if (hasDmarc) results.push('DMARC')
    else errors.push('DMARC record missing')
  } catch { errors.push('DMARC lookup failed') }

  if (errors.length) {
    redirect(`/admin/domains/${domainId}?err=${encodeURIComponent(errors.join('; '))}`)
  }
  redirect(`/admin/domains/${domainId}?msg=${encodeURIComponent(results.join('+') + ' all verified')}`)
}

export async function setPrimaryDomain(domainId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()

  // Domain must be verified and belong to this org
  const rows = await db`
    SELECT id, domain, verified_at FROM domains
    WHERE id = ${domainId} AND org_id = ${session.orgId!}
  `
  if (!rows.length) redirect('/admin/domains?err=Domain+not+found')
  const row = rows[0] as { verified_at: string | null; domain: string }
  if (!row.verified_at) redirect('/admin/domains?err=Verify+the+domain+before+setting+it+as+primary')

  await db.begin(async sql => {
    await sql`UPDATE domains SET is_primary = false WHERE org_id = ${session.orgId!}`
    await sql`UPDATE domains SET is_primary = true  WHERE id = ${domainId}`
  })

  redirect(`/admin/domains?msg=${encodeURIComponent(row.domain + ' is now the primary domain')}`)
}

// ── Domain health checks ───────────────────────────────────────────────────────

type HealthResult = { status: 'healthy' | 'degraded' | 'error'; issues: string[] }

async function runDnsHealthCheck(
  domain: string,
  verificationToken: string,
  emailConfig: { dkim_selector: string | null; dkim_public_key: string | null; dmarc_policy: string | null } | null
): Promise<HealthResult> {
  const { resolveTxt } = await import('dns/promises')
  const issues: string[] = []

  // 1. Ownership TXT — must still be present
  try {
    const ownershipRecs = await resolveTxt(`_foundry-verify.${domain}`)
    const needle = `foundry-verify=${verificationToken}`
    if (!ownershipRecs.some(r => r.join('').includes(needle))) {
      issues.push('Ownership TXT record missing or changed')
    }
  } catch { issues.push('Ownership TXT record lookup failed') }

  // 2. SPF — check if email config exists
  if (emailConfig) {
    try {
      const spfRecs = await resolveTxt(domain)
      if (!spfRecs.some(r => r.join('').startsWith('v=spf1'))) {
        issues.push('SPF record missing')
      }
    } catch { issues.push('SPF record lookup failed') }

    // 3. DKIM
    if (emailConfig.dkim_public_key && emailConfig.dkim_selector) {
      try {
        const dkimRecs = await resolveTxt(`${emailConfig.dkim_selector}._domainkey.${domain}`)
        if (!dkimRecs.some(r => r.join('').includes('v=DKIM1'))) {
          issues.push('DKIM record missing')
        }
      } catch { issues.push('DKIM record lookup failed') }
    }

    // 4. DMARC
    try {
      const dmarcRecs = await resolveTxt(`_dmarc.${domain}`)
      if (!dmarcRecs.some(r => r.join('').startsWith('v=DMARC1'))) {
        issues.push('DMARC record missing')
      }
    } catch { issues.push('DMARC record lookup failed') }
  }

  const ownershipFailed = issues.some(i => i.toLowerCase().includes('ownership'))
  const status = issues.length === 0 ? 'healthy' : ownershipFailed ? 'error' : 'degraded'
  return { status, issues }
}

export async function checkDomainHealth(domainId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()

  const rows = await db`
    SELECT d.domain, d.verification_token,
           ec.dkim_selector, ec.dkim_public_key, ec.dmarc_policy
    FROM domains d
    LEFT JOIN domain_email_config ec ON ec.domain_id = d.id
    WHERE d.id = ${domainId} AND d.org_id = ${session.orgId!}
  `
  if (!rows.length) redirect('/admin/domains?err=Domain+not+found')
  const row = rows[0] as {
    domain: string; verification_token: string
    dkim_selector: string | null; dkim_public_key: string | null; dmarc_policy: string | null
  }

  const emailConfig = row.dkim_selector ? {
    dkim_selector: row.dkim_selector, dkim_public_key: row.dkim_public_key, dmarc_policy: row.dmarc_policy
  } : null

  const { status, issues } = await runDnsHealthCheck(row.domain, row.verification_token, emailConfig)

  await db`
    UPDATE domains SET
      health_status     = ${status},
      health_issues     = ${JSON.stringify(issues)}::jsonb,
      health_checked_at = NOW()
    WHERE id = ${domainId}
  `

  const msg = status === 'healthy'
    ? encodeURIComponent(`${row.domain} is healthy`)
    : encodeURIComponent(`${row.domain}: ${issues.join('; ')}`)

  if (status === 'healthy') redirect(`/admin/domains?msg=${msg}`)
  else redirect(`/admin/domains?err=${msg}`)
}

export async function checkAllDomainHealth(_fd: FormData): Promise<void> {
  const session = await requireAdmin()

  const rows = await db`
    SELECT d.id, d.domain, d.verification_token,
           ec.dkim_selector, ec.dkim_public_key, ec.dmarc_policy
    FROM domains d
    LEFT JOIN domain_email_config ec ON ec.domain_id = d.id
    WHERE d.org_id = ${session.orgId!}
  ` as unknown as Array<{
    id: string; domain: string; verification_token: string
    dkim_selector: string | null; dkim_public_key: string | null; dmarc_policy: string | null
  }>

  // Process DNS checks in batches of 3 to avoid flooding the resolver
  for (let i = 0; i < rows.length; i += 3) {
    await Promise.all(rows.slice(i, i + 3).map(async row => {
    const emailConfig = row.dkim_selector ? {
      dkim_selector: row.dkim_selector, dkim_public_key: row.dkim_public_key, dmarc_policy: row.dmarc_policy
    } : null
    const { status, issues } = await runDnsHealthCheck(row.domain, row.verification_token, emailConfig)
    await db`
      UPDATE domains SET
        health_status     = ${status},
        health_issues     = ${JSON.stringify(issues)}::jsonb,
        health_checked_at = NOW()
      WHERE id = ${row.id}
    `
  }))
  }

  redirect('/admin/domains?msg=Health+check+complete')
}

// ── App access ────────────────────────────────────────────────────────────────

const VALID_APPS = ['docs', 'sheets', 'mail', 'wiki'] as const

export async function updateAppAccess(userId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()

  const target = await getOrgUser(session.orgId!, userId)
  if (!target) redirect(`/admin/users/${userId}?err=User+not+found`)
  if (!canActOn(session.role!, target.role)) redirect(`/admin/users/${userId}?err=Insufficient+permissions`)

  // Upsert one row per app — checkbox presence = enabled
  await Promise.all(VALID_APPS.map(app => {
    const enabled = formData.get(`app_${app}`) === 'on'
    return db`
      INSERT INTO user_app_access (org_id, user_id, app, enabled, updated_at)
      VALUES (${session.orgId!}, ${userId}, ${app}, ${enabled}, NOW())
      ON CONFLICT (org_id, user_id, app) DO UPDATE
        SET enabled = EXCLUDED.enabled, updated_at = NOW()
    `
  }))

  await writeAudit({ orgId: session.orgId!, actorId: session.userId, actorEmail: session.email, action: 'user.app_access_change', targetId: userId, targetEmail: target.email })
  redirect(`/admin/users/${userId}?msg=App+access+updated`)
}

// ── Org app defaults ──────────────────────────────────────────────────────────

export async function updateOrgAppDefaults(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  if (!session.orgId) redirect('/admin/apps')

  await Promise.all(VALID_APPS.map(app => {
    const enabled = formData.get(`app_${app}`) === 'on'
    return db`
      INSERT INTO org_app_defaults (org_id, app, enabled)
      VALUES (${session.orgId!}, ${app}, ${enabled})
      ON CONFLICT (org_id, app) DO UPDATE SET enabled = EXCLUDED.enabled
    `
  }))

  const defaults = Object.fromEntries(VALID_APPS.map(app => [app, formData.get(`app_${app}`) === 'on']))
  await writeAudit({ orgId: session.orgId!, actorId: session.userId, actorEmail: session.email, action: 'org.app_defaults_update', metadata: { defaults } })
  redirect('/admin/apps?msg=Default+app+access+saved')
}

// ── Session management ────────────────────────────────────────────────────────

export async function forceSignOut(sessionId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()

  // Verify session belongs to this org before deleting
  const rows = await db`
    SELECT s.id, u.email, u.id as user_id FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ${sessionId} AND s.org_id = ${session.orgId!} AND s.expires_at > NOW()
  `
  if (!rows.length) redirect('/admin/sessions?err=Session+not+found')
  const row = rows[0] as { email: string; user_id: string }

  await db`DELETE FROM sessions WHERE id = ${sessionId}`
  await writeAudit({
    orgId: session.orgId!,
    actorId: session.userId,
    actorEmail: session.email,
    action: 'session.force_sign_out',
    targetId: row.user_id,
    targetEmail: row.email,
    metadata: { sessionId },
  })

  redirect('/admin/sessions?msg=Session+terminated')
}

export async function forceSignOutAll(userId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()

  const target = await getOrgUser(session.orgId!, userId)
  if (!target) redirect('/admin/sessions?err=User+not+found')
  if (!canActOn(session.role!, target.role)) redirect('/admin/sessions?err=Insufficient+permissions')

  const result = await db`
    DELETE FROM sessions WHERE user_id = ${userId} AND org_id = ${session.orgId!}
    RETURNING id
  `
  await writeAudit({
    orgId: session.orgId!,
    actorId: session.userId,
    actorEmail: session.email,
    action: 'session.force_sign_out_all',
    targetId: userId,
    targetEmail: target.email,
    metadata: { count: result.length },
  })

  redirect(`/admin/sessions?msg=Signed+out+${result.length}+session${result.length === 1 ? '' : 's'}+for+${encodeURIComponent(target.email)}`)
}

// ── SMTP config ───────────────────────────────────────────────────────────────

export async function updateSmtpConfig(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  if (!session.orgId) redirect('/admin/mail')

  const hostname      = (formData.get('hostname')       as string ?? '').trim()
  const inboundPort   = parseInt(formData.get('inbound_port') as string ?? '25', 10)
  const tlsMode       = (formData.get('tls_mode')       as string ?? 'starttls').trim()
  const relayEnabled  = formData.get('relay_enabled') === 'on'
  const relayHost     = (formData.get('relay_host')     as string ?? '').trim()
  const relayPort     = parseInt(formData.get('relay_port') as string ?? '587', 10)
  const relayUsername = (formData.get('relay_username') as string ?? '').trim()
  const relayPassword = (formData.get('relay_password') as string ?? '').trim()
  const fromAddress   = (formData.get('from_address')   as string ?? '').trim().toLowerCase()
  const fromName      = (formData.get('from_name')      as string ?? '').trim()

  if (!['none', 'starttls', 'tls'].includes(tlsMode)) redirect('/admin/mail?err=Invalid+TLS+mode')
  if (isNaN(inboundPort) || inboundPort < 1 || inboundPort > 65535) redirect('/admin/mail?err=Invalid+inbound+port')
  if (relayEnabled && !relayHost) redirect('/admin/mail?err=Relay+host+is+required+when+relay+is+enabled')
  if (fromAddress && !fromAddress.includes('@')) redirect('/admin/mail?err=Invalid+from+address')

  await db`
    INSERT INTO smtp_config (org_id, hostname, inbound_port, tls_mode, relay_enabled,
      relay_host, relay_port, relay_username, relay_password, from_address, from_name, updated_at)
    VALUES (${session.orgId}, ${hostname || null}, ${inboundPort}, ${tlsMode}, ${relayEnabled},
      ${relayHost || null}, ${relayPort}, ${relayUsername || null},
      ${relayPassword || null}, ${fromAddress || null}, ${fromName || null}, NOW())
    ON CONFLICT (org_id) DO UPDATE SET
      hostname       = EXCLUDED.hostname,
      inbound_port   = EXCLUDED.inbound_port,
      tls_mode       = EXCLUDED.tls_mode,
      relay_enabled  = EXCLUDED.relay_enabled,
      relay_host     = EXCLUDED.relay_host,
      relay_port     = EXCLUDED.relay_port,
      relay_username = EXCLUDED.relay_username,
      relay_password = CASE WHEN EXCLUDED.relay_password = '' THEN smtp_config.relay_password
                            ELSE EXCLUDED.relay_password END,
      from_address   = EXCLUDED.from_address,
      from_name      = EXCLUDED.from_name,
      updated_at     = NOW()
  `

  await writeAudit({
    orgId: session.orgId,
    actorId: session.userId,
    actorEmail: session.email,
    action: 'mail.smtp_config_update',
    metadata: { hostname, inboundPort, tlsMode, relayEnabled },
  })

  redirect('/admin/mail?msg=SMTP+configuration+saved')
}

// ── Groups ────────────────────────────────────────────────────────────────────

export async function createGroup(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  if (!session.orgId) redirect('/admin/groups')

  const name = (formData.get('name') as string ?? '').trim()
  const description = (formData.get('description') as string ?? '').trim()

  if (!name) redirect('/admin/groups?err=Group+name+is+required')
  if (name.length > 100) redirect('/admin/groups?err=Group+name+must+be+100+characters+or+fewer')

  const existing = await db`SELECT id FROM org_groups WHERE org_id = ${session.orgId} AND name = ${name}`
  if (existing.length) redirect('/admin/groups?err=A+group+with+that+name+already+exists')

  const rows = await db`
    INSERT INTO org_groups (org_id, name, description)
    VALUES (${session.orgId}, ${name}, ${description || null})
    RETURNING id
  `
  await writeAudit({ orgId: session.orgId, actorId: session.userId, actorEmail: session.email, action: 'group.create', metadata: { name } })
  redirect(`/admin/groups/${rows[0].id}?msg=Group+created`)
}

export async function updateGroup(groupId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()
  if (!session.orgId) redirect('/admin/groups')

  const name = (formData.get('name') as string ?? '').trim()
  const description = (formData.get('description') as string ?? '').trim()

  if (!name) redirect(`/admin/groups/${groupId}?err=Group+name+is+required`)
  if (name.length > 100) redirect(`/admin/groups/${groupId}?err=Group+name+must+be+100+characters+or+fewer`)

  const conflict = await db`
    SELECT id FROM org_groups WHERE org_id = ${session.orgId} AND name = ${name} AND id != ${groupId}
  `
  if (conflict.length) redirect(`/admin/groups/${groupId}?err=A+group+with+that+name+already+exists`)

  const result = await db`
    UPDATE org_groups SET name = ${name}, description = ${description || null}
    WHERE id = ${groupId} AND org_id = ${session.orgId}
    RETURNING id
  `
  if (!result.length) redirect(`/admin/groups/${groupId}?err=Group+not+found`)

  await writeAudit({ orgId: session.orgId, actorId: session.userId, actorEmail: session.email, action: 'group.update', metadata: { groupId, name } })
  redirect(`/admin/groups/${groupId}?msg=Group+updated`)
}

export async function deleteGroup(groupId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()
  if (!session.orgId) redirect('/admin/groups')

  const rows = await db`SELECT name FROM org_groups WHERE id = ${groupId} AND org_id = ${session.orgId}`
  if (!rows.length) redirect('/admin/groups?err=Group+not+found')

  await db`DELETE FROM org_groups WHERE id = ${groupId} AND org_id = ${session.orgId}`
  await writeAudit({ orgId: session.orgId, actorId: session.userId, actorEmail: session.email, action: 'group.delete', metadata: { groupId, name: rows[0].name } })
  redirect('/admin/groups?msg=Group+deleted')
}

export async function addGroupMember(groupId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()
  if (!session.orgId) redirect('/admin/groups')

  const userId = (formData.get('user_id') as string ?? '').trim()
  if (!userId) redirect(`/admin/groups/${groupId}?err=Select+a+user+to+add`)

  const group = await db`SELECT id, name FROM org_groups WHERE id = ${groupId} AND org_id = ${session.orgId}`
  if (!group.length) redirect(`/admin/groups/${groupId}?err=Group+not+found`)

  const member = await db`
    SELECT u.email FROM org_members m JOIN users u ON u.id = m.user_id
    WHERE m.user_id = ${userId} AND m.org_id = ${session.orgId}
  `
  if (!member.length) redirect(`/admin/groups/${groupId}?err=User+is+not+a+member+of+this+organization`)

  await db`
    INSERT INTO org_group_members (group_id, user_id) VALUES (${groupId}, ${userId})
    ON CONFLICT DO NOTHING
  `
  await writeAudit({
    orgId: session.orgId, actorId: session.userId, actorEmail: session.email,
    action: 'group.member_add', targetId: userId, targetEmail: member[0].email as string,
    metadata: { groupId, groupName: group[0].name },
  })
  redirect(`/admin/groups/${groupId}?msg=Member+added`)
}

export async function removeGroupMember(groupId: string, userId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()
  if (!session.orgId) redirect('/admin/groups')

  const group = await db`SELECT id, name FROM org_groups WHERE id = ${groupId} AND org_id = ${session.orgId}`
  if (!group.length) redirect(`/admin/groups/${groupId}?err=Group+not+found`)

  const userRows = await db`
    SELECT u.email FROM users u
    JOIN org_members m ON m.user_id = u.id AND m.org_id = ${session.orgId}
    WHERE u.id = ${userId}
  `
  await db`DELETE FROM org_group_members WHERE group_id = ${groupId} AND user_id = ${userId}`

  if (userRows.length) {
    await writeAudit({
      orgId: session.orgId, actorId: session.userId, actorEmail: session.email,
      action: 'group.member_remove', targetId: userId, targetEmail: userRows[0].email as string,
      metadata: { groupId, groupName: group[0].name },
    })
  }
  redirect(`/admin/groups/${groupId}?msg=Member+removed`)
}

// ── Invite management ─────────────────────────────────────────────────────────

export async function revokeInvite(inviteId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()
  const rows = await db`
    SELECT email FROM invites WHERE id = ${inviteId} AND org_id = ${session.orgId!}
      AND accepted_at IS NULL AND expires_at > NOW()
  `
  if (!rows.length) redirect('/admin/invites?err=Invite+not+found+or+already+used')

  await db`UPDATE invites SET expires_at = NOW() WHERE id = ${inviteId}`
  await writeAudit({
    orgId: session.orgId!, actorId: session.userId, actorEmail: session.email,
    action: 'invite.revoke', metadata: { inviteId, email: rows[0].email },
  })
  redirect('/admin/invites?msg=Invite+revoked')
}

export async function resendInvite(inviteId: string, _fd: FormData): Promise<void> {
  const session = await requireAdmin()

  const rows = await db`
    SELECT email, role FROM invites
    WHERE id = ${inviteId} AND org_id = ${session.orgId!}
      AND accepted_at IS NULL AND expires_at <= NOW()
  `
  if (!rows.length) redirect('/admin/invites?err=Invite+not+found+or+not+expired')

  const { email, role } = rows[0] as { email: string; role: string }

  const pending = await db`
    SELECT id FROM invites
    WHERE email = ${email} AND org_id = ${session.orgId!}
      AND accepted_at IS NULL AND expires_at > NOW()
  `
  if (pending.length) redirect('/admin/invites?filter=pending&err=A+pending+invite+already+exists+for+this+email')

  await db`
    INSERT INTO invites (email, role, org_id, invited_by)
    VALUES (${email}, ${role}, ${session.orgId!}, ${session.userId})
  `
  await writeAudit({
    orgId: session.orgId!, actorId: session.userId, actorEmail: session.email,
    action: 'user.invite', metadata: { email, role, resent: true },
  })
  redirect(`/admin/invites?filter=pending&msg=${encodeURIComponent('Invite resent to ' + email)}`)
}



// ── Bulk user actions ─────────────────────────────────────────────────────────

export async function bulkDeactivate(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const userIds = (formData.getAll('user_id') as string[]).filter(id => id !== session.userId)
  if (!userIds.length) redirect('/admin/users?err=No+users+selected')

  const roleFilter = session.role === 'owner' ? db`` : db`AND m.role = 'member'`
  const targets = await db`
    SELECT u.id, u.email, m.role
    FROM users u
    JOIN org_members m ON m.user_id = u.id AND m.org_id = ${session.orgId!}
    WHERE u.id = ANY(${userIds}) AND u.deactivated_at IS NULL ${roleFilter}
  ` as unknown as Array<{ id: string; email: string; role: string }>

  if (!targets.length) redirect('/admin/users?err=No+eligible+users+to+deactivate')

  const targetIds = targets.map(t => t.id)
  await db`UPDATE users SET deactivated_at = NOW() WHERE id = ANY(${targetIds})`
  await db`DELETE FROM sessions WHERE user_id = ANY(${targetIds})`
  await Promise.all(targets.map(t => writeAudit({
    orgId: session.orgId!, actorId: session.userId, actorEmail: session.email,
    action: 'user.deactivate', targetId: t.id, targetEmail: t.email,
  })))

  const count = targets.length
  redirect(`/admin/users?msg=Deactivated+${count}+user${count === 1 ? '' : 's'}`)
}

export async function bulkRemove(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const userIds = (formData.getAll('user_id') as string[]).filter(id => id !== session.userId)
  if (!userIds.length) redirect('/admin/users?err=No+users+selected')

  const roleFilter = session.role === 'owner' ? db`` : db`AND m.role = 'member'`
  const targets = await db`
    SELECT u.id, u.email, m.role
    FROM users u
    JOIN org_members m ON m.user_id = u.id AND m.org_id = ${session.orgId!}
    WHERE u.id = ANY(${userIds}) ${roleFilter}
  ` as unknown as Array<{ id: string; email: string; role: string }>

  if (!targets.length) redirect('/admin/users?err=No+eligible+users+to+remove')

  const targetIds = targets.map(t => t.id)
  await db`DELETE FROM org_members WHERE user_id = ANY(${targetIds}) AND org_id = ${session.orgId}`
  await db`UPDATE sessions SET org_id = NULL WHERE user_id = ANY(${targetIds}) AND org_id = ${session.orgId}`
  await Promise.all(targets.map(t => writeAudit({
    orgId: session.orgId!, actorId: session.userId, actorEmail: session.email,
    action: 'user.remove', targetId: t.id, targetEmail: t.email,
  })))

  const count = targets.length
  redirect(`/admin/users?msg=Removed+${count}+user${count === 1 ? '' : 's'}+from+organization`)
}

// ── Group app access ──────────────────────────────────────────────────────────

export async function updateGroupAppAccess(groupId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()
  if (!session.orgId) redirect(`/admin/groups/${groupId}`)

  const group = await db`SELECT id FROM org_groups WHERE id = ${groupId} AND org_id = ${session.orgId}`
  if (!group.length) redirect(`/admin/groups/${groupId}?err=Group+not+found`)

  await Promise.all(VALID_APPS.map(app => {
    const enabled = formData.get(`app_${app}`) === 'on'
    return db`
      INSERT INTO group_app_access (group_id, app, enabled)
      VALUES (${groupId}, ${app}, ${enabled})
      ON CONFLICT (group_id, app) DO UPDATE SET enabled = EXCLUDED.enabled
    `
  }))

  await writeAudit({
    orgId: session.orgId, actorId: session.userId, actorEmail: session.email,
    action: 'group.app_access_update', metadata: { groupId },
  })
  redirect(`/admin/groups/${groupId}?msg=App+access+saved`)
}
