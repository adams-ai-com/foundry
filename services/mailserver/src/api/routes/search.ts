import type { FastifyInstance } from 'fastify'
import { searchThreads } from '../../storage/threads.js'

export async function searchRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q: string } }>(
    '/search', async (req, reply) => {
      const accountId = (req as any).accountId as string
      const q = req.query.q?.trim()
      if (!q) return { threads: [] }
      const threads = await searchThreads(accountId, q)
      return { threads }
    }
  )
}
