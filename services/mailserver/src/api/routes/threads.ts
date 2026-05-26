import type { FastifyInstance } from 'fastify'
import { listThreads, getThread, searchThreads, deleteThread } from '../../storage/threads.js'
import { sql } from '../../db.js'
import { getMailboxId } from '../../storage/mailboxes.js'
import { refreshMailboxCounts } from '../../storage/mailboxes.js'
import { updateThreadMeta } from '../../parser/thread.js'

type Sort = 'newest' | 'oldest' | 'unread'

function orderClause(sort: Sort) {
  if (sort === 'oldest') return sql`t.last_message_at ASC NULLS LAST`
  if (sort === 'unread') return sql`(t.unread_count > 0) DESC, t.last_message_at DESC NULLS LAST`
  return sql`t.last_message_at DESC NULLS LAST`
}

function rowToThread(r: any) {
  return {
    id: r.id,
    accountId: r.account_id,
    accountDomain: r.account_domain ?? null,
    workspaceId: r.workspace_id,
    subject: r.subject,
    participants: r.participants,
    messageCount: r.message_count,
    unreadCount: r.unread_count,
    lastMessageAt: r.last_message_at,
    snippet: r.snippet,
    isStarred: r.is_starred,
    snoozedUntil: r.snoozed_until ?? null,
  }
}

export async function threadRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { mailbox?: string; page?: string; sort?: string; account_ids?: string } }>(
    '/threads', async (req, reply) => {
      const accountId = (req as any).accountId as string
      const userId = (req as any).userId as string | undefined
      const mailboxType = (req.query.mailbox ?? 'inbox') as string
      const page = Math.max(1, parseInt(req.query.page ?? '1'))
      const sort = (req.query.sort ?? 'newest') as Sort
      const pageSize = 50
      const offset = (page - 1) * pageSize
      const ord = orderClause(sort)

      // Multi-account unified query
      if (req.query.account_ids && userId) {
        const requestedIds = req.query.account_ids.split(',').map((s) => s.trim()).filter(Boolean)

        const accessible = await sql<{ account_id: string }[]>`
          SELECT account_id FROM mail_account_access
          WHERE user_id = ${userId} AND account_id = ANY(${requestedIds})
        `
        const validIds = accessible.map((r) => r.account_id)
        if (!validIds.length) return { threads: [], total: 0 }

        if (mailboxType === 'starred') {
          const [threads, countRows] = await Promise.all([
            sql<any[]>`
              SELECT DISTINCT t.*, a.domain as account_domain FROM threads t
              JOIN accounts a ON a.id = t.account_id
              WHERE t.account_id = ANY(${validIds})
                AND t.is_starred = TRUE
                AND (t.snoozed_until IS NULL OR t.snoozed_until <= NOW())
              ORDER BY ${ord}
              LIMIT ${pageSize} OFFSET ${offset}
            `,
            sql<{ count: number }[]>`
              SELECT COUNT(DISTINCT t.id)::int AS count FROM threads t
              WHERE t.account_id = ANY(${validIds}) AND t.is_starred = TRUE
                AND (t.snoozed_until IS NULL OR t.snoozed_until <= NOW())
            `,
          ])
          return { threads: threads.map(rowToThread), total: countRows[0]?.count ?? 0 }
        }

        const [threads, countRows] = await Promise.all([
          sql<any[]>`
            SELECT DISTINCT t.*, a.domain as account_domain FROM threads t
            JOIN accounts a ON a.id = t.account_id
            JOIN messages m ON m.thread_id = t.id
            JOIN mailboxes mb ON mb.id = m.mailbox_id AND mb.type = ${mailboxType}
            WHERE t.account_id = ANY(${validIds})
              AND (t.snoozed_until IS NULL OR t.snoozed_until <= NOW())
            ORDER BY ${ord}
            LIMIT ${pageSize} OFFSET ${offset}
          `,
          sql<{ count: number }[]>`
            SELECT COUNT(DISTINCT t.id)::int AS count FROM threads t
            JOIN messages m ON m.thread_id = t.id
            JOIN mailboxes mb ON mb.id = m.mailbox_id AND mb.type = ${mailboxType}
            WHERE t.account_id = ANY(${validIds})
              AND (t.snoozed_until IS NULL OR t.snoozed_until <= NOW())
          `,
        ])
        return { threads: threads.map(rowToThread), total: countRows[0]?.count ?? 0 }
      }

      // Single-account query — starred is a special case (flag, not a mailbox)
      if (mailboxType === 'starred') {
        const [threads, countRows] = await Promise.all([
          sql<any[]>`
            SELECT DISTINCT t.*, a.domain as account_domain FROM threads t
            JOIN accounts a ON a.id = t.account_id
            WHERE t.account_id = ${accountId}
              AND t.is_starred = TRUE
              AND (t.snoozed_until IS NULL OR t.snoozed_until <= NOW())
            ORDER BY ${ord}
            LIMIT ${pageSize} OFFSET ${offset}
          `,
          sql<{ count: number }[]>`
            SELECT COUNT(*)::int AS count FROM threads t
            WHERE t.account_id = ${accountId} AND t.is_starred = TRUE
              AND (t.snoozed_until IS NULL OR t.snoozed_until <= NOW())
          `,
        ])
        return { threads: threads.map(rowToThread), total: countRows[0]?.count ?? 0 }
      }

      const mailboxId = await getMailboxId(accountId, mailboxType as any)
      const result = await listThreads(accountId, mailboxId, page, pageSize, sort)
      // Include account domain for single-account results too
      const domain = await sql<{ domain: string }[]>`SELECT domain FROM accounts WHERE id = ${accountId} LIMIT 1`
      const accountDomain = domain[0]?.domain ?? null
      return {
        threads: result.threads.map((t) => ({ ...t, accountDomain })),
        total: result.total,
      }
    }
  )

  app.get<{ Params: { id: string } }>(
    '/threads/:id', async (req, reply) => {
      const accountId = (req as any).accountId as string
      const thread = await getThread(accountId, req.params.id)
      if (!thread) return reply.code(404).send({ error: 'Not found' })

      await sql`
        UPDATE messages SET is_read = true
        WHERE thread_id = ${req.params.id} AND account_id = ${accountId} AND NOT is_read
      `
      await updateThreadMeta(req.params.id, accountId)
      await refreshMailboxCounts(accountId)

      return thread
    }
  )

  app.patch<{ Params: { id: string }; Body: { action: string } }>(
    '/threads/:id', async (req, reply) => {
      const accountId = (req as any).accountId as string
      const { action } = req.body

      const validActions = ['archive', 'trash', 'inbox', 'spam', 'star', 'unstar', 'unread']
      if (!validActions.includes(action)) {
        return reply.code(400).send({ error: 'Invalid action' })
      }

      if (action === 'star' || action === 'unstar') {
        await sql`
          UPDATE threads SET is_starred = ${action === 'star'}
          WHERE id = ${req.params.id} AND account_id = ${accountId}
        `
      } else if (action === 'unread') {
        await sql`
          UPDATE messages SET is_read = false
          WHERE thread_id = ${req.params.id} AND account_id = ${accountId}
        `
        await updateThreadMeta(req.params.id, accountId)
        await refreshMailboxCounts(accountId)
      } else {
        const mailboxId = await getMailboxId(accountId, action as any)
        await sql`
          UPDATE messages SET mailbox_id = ${mailboxId}
          WHERE thread_id = ${req.params.id} AND account_id = ${accountId}
        `
        await refreshMailboxCounts(accountId)
      }

      return { ok: true }
    }
  )

  app.delete<{ Params: { id: string } }>(
    '/threads/:id', async (req, reply) => {
      const accountId = (req as any).accountId as string
      await deleteThread(accountId, req.params.id)
      return reply.code(204).send()
    }
  )
}
