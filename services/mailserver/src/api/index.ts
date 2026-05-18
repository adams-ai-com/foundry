import Fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from '../config.js'
import { sql } from '../db.js'
import { mailboxRoutes } from './routes/mailboxes.js'
import { threadRoutes } from './routes/threads.js'
import { messageRoutes } from './routes/messages.js'
import { sendRoutes } from './routes/send.js'
import { searchRoutes } from './routes/search.js'
import { attachmentRoutes } from './routes/attachments.js'
import { calendarRoutes } from './routes/calendar.js'
import { contactRoutes } from './routes/contacts.js'
import { taskRoutes } from './routes/tasks.js'
import { decisionRoutes } from './routes/decisions.js'
import { fileRoutes } from './routes/files.js'

export async function buildApi() {
  const app = Fastify({ logger: { level: 'warn' } })

  await app.register(cors, { origin: false })
  await app.register((await import('@fastify/multipart')).default, { limits: { fileSize: 100 * 1024 * 1024 } })

  // Auth — API key + account resolution
  app.addHook('preHandler', async (req, reply) => {
    if (req.url === '/health') return

    const apiKey = req.headers['x-api-key']
    if (apiKey !== config.apiKey) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    // Account is passed via header; the client (apps/mail) sets it after login
    const accountId = req.headers['x-account-id'] as string
    if (!accountId) return reply.code(400).send({ error: 'X-Account-Id required' })

    const rows = await sql<{ id: string }[]>`
      SELECT id FROM accounts WHERE id = ${accountId} LIMIT 1
    `
    if (!rows.length) return reply.code(404).send({ error: 'Account not found' })

    ;(req as any).accountId = accountId
  })

  app.get('/health', async () => ({ ok: true, service: 'foundry-mailserver' }))

  // Register all route modules under /api/v1
  const opts = { prefix: '/api/v1' }
  await app.register(mailboxRoutes, opts)
  await app.register(threadRoutes, opts)
  await app.register(messageRoutes, opts)
  await app.register(sendRoutes, opts)
  await app.register(searchRoutes, opts)
  await app.register(attachmentRoutes, opts)
  await app.register(calendarRoutes, opts)
  await app.register(contactRoutes, opts)
  await app.register(taskRoutes, opts)
  await app.register(decisionRoutes, opts)
  await app.register(fileRoutes, opts)

  return app
}

export async function startApi() {
  const app = await buildApi()
  await app.listen({ port: config.apiPort, host: '127.0.0.1' })
  console.log(`Mail API listening on port ${config.apiPort}`)
  return app
}
