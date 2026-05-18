import type { FastifyInstance } from 'fastify'
import { sql, newId } from '../../db.js'

export async function calendarRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { start?: string; end?: string } }>(
    '/calendar/events', async (req) => {
      const accountId = (req as any).accountId as string
      const start = req.query.start ? new Date(req.query.start) : new Date()
      const end = req.query.end
        ? new Date(req.query.end)
        : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000)

      return sql`
        SELECT * FROM calendar_events
        WHERE account_id = ${accountId}
          AND start_at >= ${start} AND start_at <= ${end}
        ORDER BY start_at ASC
      `
    }
  )

  app.post<{
    Body: {
      title: string; description?: string; location?: string
      startAt: string; endAt: string; allDay?: boolean
      attendees?: { name?: string; email: string }[]
      sourceMessageId?: string
    }
  }>('/calendar/events', async (req) => {
    const accountId = (req as any).accountId as string
    const b = req.body
    const id = newId()

    await sql`
      INSERT INTO calendar_events (id, account_id, title, description, location,
        start_at, end_at, all_day, attendees, source_message_id)
      VALUES (${id}, ${accountId}, ${b.title}, ${b.description ?? null},
        ${b.location ?? null}, ${new Date(b.startAt)}, ${new Date(b.endAt)},
        ${b.allDay ?? false}, ${JSON.stringify(b.attendees ?? [])},
        ${b.sourceMessageId ?? null})
    `
    return { id }
  })

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/calendar/events/:id', async (req, reply) => {
      const accountId = (req as any).accountId as string
      const b = req.body

      const allowed = ['title', 'description', 'location', 'start_at', 'end_at', 'all_day', 'attendees']
      const updates = Object.entries(b).filter(([k]) => allowed.includes(k))
      if (!updates.length) return reply.code(400).send({ error: 'No valid fields' })

      for (const [key, value] of updates) {
        await sql`
          UPDATE calendar_events SET ${sql(key)} = ${value as any}, updated_at = NOW()
          WHERE id = ${req.params.id} AND account_id = ${accountId}
        `
      }
      return { ok: true }
    }
  )

  app.delete<{ Params: { id: string } }>(
    '/calendar/events/:id', async (req) => {
      const accountId = (req as any).accountId as string
      await sql`DELETE FROM calendar_events WHERE id = ${req.params.id} AND account_id = ${accountId}`
      return { ok: true }
    }
  )
}
