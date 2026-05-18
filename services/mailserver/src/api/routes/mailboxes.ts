import type { FastifyInstance } from 'fastify'
import { listMailboxes, ensureSystemMailboxes } from '../../storage/mailboxes.js'

export async function mailboxRoutes(app: FastifyInstance) {
  app.get('/mailboxes', async (req) => {
    const accountId = (req as any).accountId as string
    await ensureSystemMailboxes(accountId)
    return listMailboxes(accountId)
  })
}
