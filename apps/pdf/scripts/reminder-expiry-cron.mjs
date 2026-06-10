#!/usr/bin/env node
// S5: Daily reminder + expiry enforcement cron for Foundry PDF envelopes.
//
// Reminder logic:
//   - Finds active unsigned recipients where:
//       envelope status IN ('sent', 'partial')
//       expires_at > now() + 1 day  (don't nag on last day)
//       sent_at < now() - 1 day     (give them at least a day before first reminder)
//       last_reminded_at IS NULL OR last_reminded_at < now() - 3 days
//   - Fires signing_reminder webhook for each, updates last_reminded_at
//
// Expiry logic:
//   - Finds envelopes where expires_at < now() and status IN ('sent', 'partial')
//   - Voids them: marks envelope voided, marks active recipients voided, logs event
//   - Fires signing_expired webhook to creator (signing_complete event type re-used
//     with an "expired" context — no separate trigger needed)

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import postgres from 'postgres'
import { createHmac } from 'node:crypto'
import { randomUUID } from 'node:crypto'

// ── Config ────────────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dir, '..', '.env')

function loadEnv(path) {
  const lines = readFileSync(path, 'utf8').split('\n')
  for (const line of lines) {
    const [k, ...rest] = line.split('=')
    if (k && rest.length && !process.env[k]) {
      process.env[k] = rest.join('=').trim()
    }
  }
}
loadEnv(envPath)

const DB_URL        = process.env.FOUNDRY_PDF_DB_URL
const WEBHOOK_URL   = process.env.SIGNING_EMAIL_WEBHOOK_URL
const WEBHOOK_SECRET = process.env.PDF_SIGNING_WEBHOOK_SECRET
const BASE_URL      = process.env.SIGNING_BASE_URL ?? 'https://foundry.adams-ai.com'

if (!DB_URL)          { console.error('FOUNDRY_PDF_DB_URL not set'); process.exit(1) }
if (!WEBHOOK_URL)     { console.error('SIGNING_EMAIL_WEBHOOK_URL not set'); process.exit(1) }
if (!WEBHOOK_SECRET)  { console.error('PDF_SIGNING_WEBHOOK_SECRET not set'); process.exit(1) }

const db = postgres(DB_URL, { max: 3, idle_timeout: 10 })

// ── Webhook helper ────────────────────────────────────────────────────────────

async function fireWebhook(payload) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-PDF-Signing-Secret': WEBHOOK_SECRET },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`webhook ${res.status}: ${t}`)
  }
}

// ── Reminder pass ─────────────────────────────────────────────────────────────

async function runReminders() {
  const rows = await db`
    SELECT
      r.id AS recipient_id, r.name AS recipient_name, r.email AS recipient_email,
      r.token,
      e.id AS envelope_id, e.title, e.expires_at,
      e.creator_name, e.creator_email
    FROM envelope_recipients r
    JOIN envelopes e ON e.id = r.envelope_id
    WHERE r.status = 'active'
      AND e.status IN ('sent', 'partial')
      AND e.expires_at > now() + INTERVAL '1 day'
      AND r.sent_at < now() - INTERVAL '1 day'
      AND (r.last_reminded_at IS NULL OR r.last_reminded_at < now() - INTERVAL '3 days')
    ORDER BY e.expires_at ASC
  `

  console.log(`[reminders] ${rows.length} recipient(s) to remind`)

  for (const r of rows) {
    const signingUrl = `${BASE_URL}/pdf/sign/${r.token}`
    const expiresAt  = r.expires_at
      ? new Date(r.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : ''

    try {
      await fireWebhook({
        event: 'signing_reminder',
        recipient_email: r.recipient_email,
        recipient_name: r.recipient_name,
        document_title: r.title,
        creator_name: r.creator_name,
        signing_url: signingUrl,
        envelope_id: r.envelope_id,
        expires_at: expiresAt,
      })

      await db`
        UPDATE envelope_recipients
        SET last_reminded_at = now()
        WHERE id = ${r.recipient_id}
      `
      console.log(`[reminders] sent reminder to ${r.recipient_email} for envelope ${r.envelope_id.slice(0, 8)}`)
    } catch (err) {
      console.error(`[reminders] failed for ${r.recipient_email}: ${err.message}`)
    }
  }
}

// ── Expiry pass ───────────────────────────────────────────────────────────────

async function runExpiry() {
  const expired = await db`
    SELECT id, title, creator_name, creator_email
    FROM envelopes
    WHERE expires_at < now()
      AND status IN ('sent', 'partial')
  `

  console.log(`[expiry] ${expired.length} envelope(s) to expire`)

  for (const env of expired) {
    try {
      await db.begin(async sql => {
        await sql`
          UPDATE envelope_recipients
          SET status = 'voided'
          WHERE envelope_id = ${env.id} AND status = 'active'
        `
        await sql`
          UPDATE envelopes SET status = 'voided'
          WHERE id = ${env.id}
        `
        await sql`
          INSERT INTO signing_events (envelope_id, event, detail)
          VALUES (${env.id}, 'expired', ${{ reason: 'expires_at passed' }})
        `
      })

      // Notify creator
      await fireWebhook({
        event: 'signing_complete',   // re-used — panel/Guardian just sends the email
        recipient_email: env.creator_email,
        recipient_name: env.creator_name,
        document_title: env.title + ' (expired — signatures not collected)',
        envelope_id: env.id,
      })

      console.log(`[expiry] voided envelope ${env.id.slice(0, 8)} (${env.title})`)
    } catch (err) {
      console.error(`[expiry] failed for envelope ${env.id.slice(0, 8)}: ${err.message}`)
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[pdf-cron] start ${new Date().toISOString()}`)
  try {
    await runReminders()
    await runExpiry()
  } finally {
    await db.end()
  }
  console.log(`[pdf-cron] done ${new Date().toISOString()}`)
}

main().catch(err => { console.error('[pdf-cron] fatal:', err); process.exit(1) })
