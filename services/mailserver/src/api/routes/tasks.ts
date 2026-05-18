import type { FastifyInstance } from 'fastify'
import { listTasks, getTask, createTask, updateTask, deleteTask } from '../../storage/tasks.js'

export async function taskRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { status?: string; page?: string } }>(
    '/tasks',
    async (req) => {
      const accountId = (req as any).accountId as string
      const page = Math.max(1, parseInt(req.query.page ?? '1'))
      return listTasks(accountId, { status: req.query.status, limit: 50, offset: (page - 1) * 50 })
    },
  )

  app.get<{ Params: { id: string } }>(
    '/tasks/:id',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const task = await getTask(accountId, req.params.id)
      if (!task) return reply.code(404).send({ error: 'Not found' })
      return task
    },
  )

  app.post<{
    Body: {
      title: string
      description?: string
      status?: string
      priority?: string
      assignedTo?: string
      dueAt?: string
      sourceThreadId?: string
      sourceDecisionId?: string
    }
  }>(
    '/tasks',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      if (!req.body.title?.trim()) return reply.code(400).send({ error: 'title required' })
      const task = await createTask(accountId, req.body as any)
      return reply.code(201).send(task)
    },
  )

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/tasks/:id',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const task = await updateTask(accountId, req.params.id, req.body as any)
      if (!task) return reply.code(404).send({ error: 'Not found' })
      return task
    },
  )

  app.delete<{ Params: { id: string } }>(
    '/tasks/:id',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const ok = await deleteTask(accountId, req.params.id)
      if (!ok) return reply.code(404).send({ error: 'Not found' })
      return reply.code(204).send()
    },
  )
}
