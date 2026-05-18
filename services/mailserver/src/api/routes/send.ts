import type { FastifyInstance } from 'fastify'
import { sendMessage } from '../../smtp/sender.js'
import { sql } from '../../db.js'

export async function sendRoutes(app: FastifyInstance) {
  app.post<{
    Body: {
      from: string
      fromName?: string
      to: { name?: string; email: string }[]
      cc?: { name?: string; email: string }[]
      bcc?: { name?: string; email: string }[]
      subject: string
      bodyHtml?: string
      bodyText?: string
      inReplyTo?: string
      references?: string
      threadId?: string
    }
  }>('/send', async (req, reply) => {
    const accountId = (req as any).accountId as string
    const b = req.body

    if (!b.from || !b.to?.length || !b.subject) {
      return reply.code(400).send({ error: 'from, to, and subject are required' })
    }

    // Verify from address belongs to this account
    const domain = b.from.split('@')[1]
    const account = await sql<{ domain: string }[]>`
      SELECT domain FROM accounts WHERE id = ${accountId} LIMIT 1
    `
    if (!account.length || account[0].domain !== domain) {
      return reply.code(403).send({ error: 'from address does not match account domain' })
    }

    const messageId = await sendMessage({
      accountId,
      from: b.from,
      fromName: b.fromName ?? '',
      to: b.to,
      cc: b.cc,
      bcc: b.bcc,
      subject: b.subject,
      bodyHtml: b.bodyHtml,
      bodyText: b.bodyText,
      inReplyTo: b.inReplyTo,
      references: b.references,
      threadId: b.threadId,
    })

    return { messageId }
  })
}
