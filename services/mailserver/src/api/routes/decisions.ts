import type { FastifyInstance } from 'fastify'
import {
  listDecisions,
  getDecision,
  createDecision,
  updateDecision,
  deleteDecision,
} from '../../storage/decisions.js'

export async function decisionRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { page?: string } }>(
    '/decisions',
    async (req) => {
      const accountId = (req as any).accountId as string
      const page = Math.max(1, parseInt(req.query.page ?? '1'))
      return listDecisions(accountId, { limit: 50, offset: (page - 1) * 50 })
    },
  )

  app.get<{ Params: { id: string } }>(
    '/decisions/:id',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const decision = await getDecision(accountId, req.params.id)
      if (!decision) return reply.code(404).send({ error: 'Not found' })
      return decision
    },
  )

  app.post<{
    Body: {
      subject: string
      outcome: string
      decidedBy?: string
      decidedAt?: string
      sourceThreadId?: string
      sourceMeetingId?: string
    }
  }>(
    '/decisions',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      if (!req.body.subject?.trim()) return reply.code(400).send({ error: 'subject required' })
      if (!req.body.outcome?.trim()) return reply.code(400).send({ error: 'outcome required' })
      const decision = await createDecision(accountId, req.body)
      return reply.code(201).send(decision)
    },
  )

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/decisions/:id',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const decision = await updateDecision(accountId, req.params.id, req.body as any)
      if (!decision) return reply.code(404).send({ error: 'Not found' })
      return decision
    },
  )

  app.delete<{ Params: { id: string } }>(
    '/decisions/:id',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const ok = await deleteDecision(accountId, req.params.id)
      if (!ok) return reply.code(404).send({ error: 'Not found' })
      return reply.code(204).send()
    },
  )
}
