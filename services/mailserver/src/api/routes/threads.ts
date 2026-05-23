import type { FastifyInstance } from 'fastify'
import { listThreads, getThread, searchThreads, deleteThread } from '../../storage/threads.js'
import { sql } from '../../db.js'
import { getMailboxId } from '../../storage/mailboxes.js'
import { refreshMailboxCounts } from '../../storage/mailboxes.js'
import { updateThreadMeta } from '../../parser/thread.js'

export async function threadRoutes(app: FastifyInstance) {
  // List threads in a mailbox
  app.get<{ Querystring: { mailbox?: string; page?: string; sort?: string } }>(
    '/threads', async (req, reply) => {
      const accountId = (req as any).accountId as string
      const mailboxType = (req.query.mailbox ?? 'inbox') as any
      const page = parseInt(req.query.page ?? '1')
      const sort = (req.query.sort ?? 'newest') as 'newest' | 'oldest' | 'unread'

      const mailboxId = await getMailboxId(accountId, mailboxType)
      const result = await listThreads(accountId, mailboxId, page, 50, sort)
      return result
    }
  )

  // Get a single thread with all messages
  app.get<{ Params: { id: string } }>(
    '/threads/:id', async (req, reply) => {
      const accountId = (req as any).accountId as string
      const thread = await getThread(accountId, req.params.id)
      if (!thread) return reply.code(404).send({ error: 'Not found' })

      // Mark all messages in thread as read
      await sql`
        UPDATE messages SET is_read = true
        WHERE thread_id = ${req.params.id} AND account_id = ${accountId} AND NOT is_read
      `
      await updateThreadMeta(req.params.id, accountId)
      await refreshMailboxCounts(accountId)

      return thread
    }
  )

  // Patch (action) a thread
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

  // Permanently delete a thread
  app.delete<{ Params: { id: string } }>(
    '/threads/:id', async (req, reply) => {
      const accountId = (req as any).accountId as string
      await deleteThread(accountId, req.params.id)
      return reply.code(204).send()
    }
  )
}
