import type { FastifyInstance } from 'fastify'
import {
  listChannels,
  getChannel,
  createChannel,
  deleteChannel,
  listMessages,
  postMessage,
  editMessage,
  deleteMessage,
  listChannelReactions,
  toggleReaction,
} from '../../storage/channels.js'

export async function channelRoutes(app: FastifyInstance) {
  // ── Channels ─────────────────────────────────────────────────────────────

  app.get('/channels', async (req) => {
    const accountId = (req as any).accountId as string
    return listChannels(accountId)
  })

  app.post<{ Body: { name: string; description?: string; isPrivate?: boolean } }>(
    '/channels',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      if (!req.body.name?.trim()) return reply.code(400).send({ error: 'name required' })
      try {
        const channel = await createChannel(accountId, { ...req.body, createdBy: req.body.name })
        return reply.code(201).send(channel)
      } catch (err: any) {
        if (err.code === '23505') return reply.code(409).send({ error: 'Channel name already exists' })
        throw err
      }
    },
  )

  app.delete<{ Params: { id: string } }>(
    '/channels/:id',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const ok = await deleteChannel(accountId, req.params.id)
      if (!ok) return reply.code(404).send({ error: 'Not found or cannot delete #general' })
      return reply.code(204).send()
    },
  )

  // ── Messages ──────────────────────────────────────────────────────────────

  app.get<{ Params: { id: string }; Querystring: { limit?: string; before?: string; after?: string } }>(
    '/channels/:id/messages',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const channel = await getChannel(accountId, req.params.id)
      if (!channel) return reply.code(404).send({ error: 'Channel not found' })

      const messages = await listMessages(channel.id, accountId, {
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        before: req.query.before,
        after: req.query.after,
      })
      return messages
    },
  )

  app.post<{
    Params: { id: string }
    Body: { senderName: string; senderEmail: string; body: string }
  }>(
    '/channels/:id/messages',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const channel = await getChannel(accountId, req.params.id)
      if (!channel) return reply.code(404).send({ error: 'Channel not found' })
      if (!req.body.body?.trim()) return reply.code(400).send({ error: 'body required' })

      const message = await postMessage(channel.id, accountId, {
        senderName: req.body.senderName || req.body.senderEmail,
        senderEmail: req.body.senderEmail,
        body: req.body.body.trim(),
      })
      return reply.code(201).send(message)
    },
  )

  app.delete<{ Params: { id: string; msgId: string } }>(
    '/channels/:id/messages/:msgId',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const ok = await deleteMessage(req.params.id, accountId, req.params.msgId)
      if (!ok) return reply.code(404).send({ error: 'Not found' })
      return reply.code(204).send()
    },
  )
  app.patch<{ Params: { id: string; msgId: string }; Body: { body: string } }>(
    '/channels/:id/messages/:msgId',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      if (!req.body.body?.trim()) return reply.code(400).send({ error: 'body required' })
      const message = await editMessage(req.params.id, accountId, req.params.msgId, req.body.body.trim())
      if (!message) return reply.code(404).send({ error: 'Not found' })
      return message
    },
  )

  // Allowed emoji set (keep tight; expand explicitly)
  const ALLOWED_EMOJI = ['👍','👎','❤️','😂','🎉','🚀','👀','🔥','✅','❌','😮','😢']

  // GET /channels/:id/reactions
  app.get<{ Params: { id: string } }>(
    '/channels/:id/reactions',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const channel = await getChannel(accountId, req.params.id)
      if (!channel) return reply.code(404).send({ error: 'Channel not found' })
      return listChannelReactions(channel.id, accountId)
    },
  )

  // PUT /channels/:id/messages/:msgId/reactions  — toggle
  app.put<{ Params: { id: string; msgId: string }; Body: { emoji: string } }>(
    '/channels/:id/messages/:msgId/reactions',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      if (!ALLOWED_EMOJI.includes(req.body.emoji))
        return reply.code(400).send({ error: 'emoji not in allowed set' })
      const result = await toggleReaction(req.params.msgId, accountId, req.body.emoji)
      return result
    },
  )

}
