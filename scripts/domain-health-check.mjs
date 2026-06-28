#!/usr/bin/env node
// Daily domain health check — runs outside Next.js, updates DB directly
import { readFileSync } from 'fs'
import { resolveTxt } from 'dns/promises'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const require = createRequire(join(REPO_ROOT, 'apps/workspace/package.json'))
const postgres = require('postgres')

// Load DATABASE_URL from workspace env file (or set DATABASE_URL env var directly)
const envFile = process.env.DATABASE_URL
  ? `DATABASE_URL=${process.env.DATABASE_URL}`
  : readFileSync(join(REPO_ROOT, 'apps/workspace/.env'), 'utf8')
const dbUrl = envFile.split('\n')
  .map(l => l.trim())
  .find(l => l.startsWith('DATABASE_URL='))
  ?.replace('DATABASE_URL=', '')
  .replace(/^["']|["']$/g, '')

if (!dbUrl) { console.error('DATABASE_URL not found'); process.exit(1) }

const db = postgres(dbUrl, { max: 2 })

async function checkTxt(host, needle) {
  try {
    const recs = await resolveTxt(host)
    return recs.some(r => r.join('').includes(needle))
  } catch { return false }
}

async function checkDomain(domain) {
  const issues = []

  // Ownership TXT
  const ownershipOk = await checkTxt(
    `_foundry-verify.${domain.domain}`,
    `foundry-verify=${domain.verification_token}`
  )
  if (!ownershipOk) issues.push('Ownership TXT record missing or changed')

  // Email records (only if email config present)
  if (domain.dkim_selector) {
    const spfOk = await checkTxt(domain.domain, 'v=spf1')
    if (!spfOk) issues.push('SPF record missing')

    if (domain.dkim_public_key) {
      const dkimOk = await checkTxt(`${domain.dkim_selector}._domainkey.${domain.domain}`, 'v=DKIM1')
      if (!dkimOk) issues.push('DKIM record missing')
    }

    const dmarcOk = await checkTxt(`_dmarc.${domain.domain}`, 'v=DMARC1')
    if (!dmarcOk) issues.push('DMARC record missing')
  }

  const ownershipFailed = issues.some(i => i.includes('Ownership'))
  const status = issues.length === 0 ? 'healthy' : ownershipFailed ? 'error' : 'degraded'
  return { status, issues }
}

async function main() {
  const rows = await db`
    SELECT d.id, d.domain, d.verification_token,
           ec.dkim_selector, ec.dkim_public_key
    FROM domains d
    LEFT JOIN domain_email_config ec ON ec.domain_id = d.id
    WHERE d.verified_at IS NOT NULL
  `

  console.log(`Checking ${rows.length} domain(s)...`)
  for (const row of rows) {
    const { status, issues } = await checkDomain(row)
    await db`
      UPDATE domains SET
        health_status     = ${status},
        health_issues     = ${JSON.stringify(issues)}::jsonb,
        health_checked_at = NOW()
      WHERE id = ${row.id}
    `
    console.log(`${row.domain}: ${status}${issues.length ? ' — ' + issues.join('; ') : ''}`)
  }

  await db.end()
  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(1) })
