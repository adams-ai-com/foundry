import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { db } from '@/lib/db'
import { fireSigningWebhook } from '@/lib/webhook'

type Params = { params: Promise<{ id: string }> }

const RATE_LIMIT_MS = 6_000 // 10 sends/minute

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── POST /api/envelopes/bulk-sends/[id]/send — trigger rate-limited email sends
//
// Safety: emails are NEVER sent during bulk creation. This is the ONLY place
// fireSigningWebhook is called for bulk envelopes. Requires explicit operator action.

export async function POST(_: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const [bulk] = await db`
    SELECT id, template_name, title_prefix, status, total_count, sent_count, creator_id
    FROM bulk_sends
    WHERE id = ${id} AND creator_id = ${session.userId}
  `
  if (!bulk) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (bulk.status !== 'ready') {
    return NextResponse.json(
      { error: `Cannot send: bulk is in '${bulk.status}' state` },
      { status: 409 }
    )
  }

  // Fetch all draft envelopes for this bulk send
  const draftEnvelopes = await db`
    SELECT e.id AS envelope_id, e.title, e.metadata,
           r.id AS recipient_id, r.name, r.email, r.token
    FROM envelopes e
    JOIN envelope_recipients r ON r.envelope_id = e.id
    WHERE e.bulk_send_id = ${id} AND e.status = 'draft'
    ORDER BY r.name
  `

  if (!draftEnvelopes.length) {
    return NextResponse.json({ error: 'No draft envelopes to send' }, { status: 409 })
  }

  // Mark as sending immediately (before fire-and-forget starts)
  await db`UPDATE bulk_sends SET status = 'sending' WHERE id = ${id}`

  const baseUrl = process.env.SIGNING_BASE_URL ?? 'https://foundry.adams-ai.com'
  const creatorName = (session.name ?? session.email) || ''

  // Fire-and-forget background loop — rate-limited at 10 sends/minute
  ;(async () => {
    try {
      for (const env of draftEnvelopes) {
        const meta = (env.metadata as any) ?? {}
        const branding = meta.branding ?? {}

        // Activate envelope + recipient
        await db.begin(async sql => {
          await sql`
            UPDATE envelopes SET status = 'sent' WHERE id = ${env.envelope_id}
          `
          await sql`
            UPDATE envelope_recipients
            SET status = 'active', sent_at = now()
            WHERE id = ${env.recipient_id}
          `
          await sql`
            INSERT INTO signing_events (envelope_id, recipient_id, event, actor)
            VALUES (${env.envelope_id}, ${env.recipient_id}, 'sent', ${session.userId})
          `
        })

        // Fire invitation email via webhook (→ panel → Guardian → Mailgun)
        fireSigningWebhook({
          event: 'signing_invitation',
          recipient_email: env.email as string,
          recipient_name: env.name as string,
          document_title: env.title as string,
          creator_name: branding.display_name || creatorName,
          signing_url: `${baseUrl}/pdf/sign/${env.token}`,
          envelope_id: env.envelope_id as string,
          branding,
        })

        // Update progress counter
        await db`
          UPDATE bulk_sends SET sent_count = sent_count + 1 WHERE id = ${id}
        `

        // Rate limit: 10 sends/minute
        await sleep(RATE_LIMIT_MS)
      }

      await db`UPDATE bulk_sends SET status = 'complete' WHERE id = ${id}`
    } catch (err) {
      console.error('[bulk-send] background loop error:', err)
      await db`UPDATE bulk_sends SET status = 'error' WHERE id = ${id}`.catch(() => {})
    }
  })()

  return NextResponse.json({ status: 'sending', total: draftEnvelopes.length })
}
