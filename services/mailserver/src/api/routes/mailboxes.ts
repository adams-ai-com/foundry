import type { FastifyInstance } from 'fastify'
import { listMailboxes } from '../../storage/mailboxes.js'

export async function mailboxRoutes(app: FastifyInstance) {
  app.get('/mailboxes', async (req, reply) => {
    const accountId = (req as any).accountId as string
    return listMailboxes(accountId)
  })
}
