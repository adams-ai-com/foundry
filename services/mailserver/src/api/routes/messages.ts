import type { FastifyInstance } from 'fastify'
import { getMessage, markRead, markStarred, moveToMailbox } from '../../storage/messages.js'
import { listMessageFiles } from '../../storage/files.js'

export async function messageRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    '/messages/:id', async (req, reply) => {
      const accountId = (req as any).accountId as string
      const msg = await getMessage(accountId, req.params.id)
      if (!msg) return reply.code(404).send({ error: 'Not found' })
      const attachments = await listMessageFiles(req.params.id)
      return { ...msg, attachments }
    }
  )

  app.patch<{ Params: { id: string }; Body: { isRead?: boolean; isStarred?: boolean; mailbox?: string } }>(
    '/messages/:id', async (req, reply) => {
      const accountId = (req as any).accountId as string
      const { isRead, isStarred, mailbox } = req.body

      if (isRead !== undefined) await markRead(accountId, req.params.id, isRead)
      if (isStarred !== undefined) await markStarred(accountId, req.params.id, isStarred)
      if (mailbox) await moveToMailbox(accountId, req.params.id, mailbox)

      return { ok: true }
    }
  )
}
