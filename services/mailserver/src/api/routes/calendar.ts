import type { FastifyInstance } from 'fastify'
import {
  getOrCreateDefaultCalendar, listCalendars, listEvents,
  getEvent, createEvent, updateEvent, deleteEvent,
  createAppPassword, listAppPasswords, deleteAppPassword,
} from '../../storage/calendars.js'

export async function calendarRoutes(app: FastifyInstance) {

  // ── Calendars ──────────────────────────────────────────────────────────────

  app.get('/calendars', async (req) => {
    const accountId = (req as any).accountId as string
    await getOrCreateDefaultCalendar(accountId)
    return listCalendars(accountId)
  })

  // ── Events ─────────────────────────────────────────────────────────────────

  app.get<{ Querystring: { calendarId?: string; start?: string; end?: string } }>(
    '/calendar/events',
    async (req) => {
      const accountId = (req as any).accountId as string
      const start = req.query.start ? new Date(req.query.start) : undefined
      const end = req.query.end ? new Date(req.query.end) : undefined
      return listEvents(accountId, { calendarId: req.query.calendarId, start, end })
    },
  )

  app.get<{ Params: { id: string } }>(
    '/calendar/events/:id',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const event = await getEvent(accountId, req.params.id)
      if (!event) return reply.code(404).send({ error: 'Not found' })
      return event
    },
  )

  app.post<{
    Body: {
      calendarId?: string
      title: string
      description?: string
      location?: string
      startAt: string
      endAt: string
      allDay?: boolean
      attendees?: { name?: string; email: string }[]
    }
  }>(
    '/calendar/events',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const b = req.body
      if (!b.title?.trim()) return reply.code(400).send({ error: 'title required' })
      if (!b.startAt || !b.endAt) return reply.code(400).send({ error: 'startAt and endAt required' })

      let calendarId = b.calendarId
      if (!calendarId) {
        const cal = await getOrCreateDefaultCalendar(accountId)
        calendarId = cal.id
      }

      const event = await createEvent(accountId, calendarId, {
        title: b.title,
        description: b.description,
        location: b.location,
        startAt: new Date(b.startAt),
        endAt: new Date(b.endAt),
        allDay: b.allDay ?? false,
        attendees: b.attendees,
      })
      return reply.code(201).send(event)
    },
  )

  app.patch<{
    Params: { id: string }
    Body: Partial<{
      title: string
      description: string | null
      location: string | null
      startAt: string
      endAt: string
      allDay: boolean
    }>
  }>(
    '/calendar/events/:id',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const b = req.body
      const event = await updateEvent(accountId, req.params.id, {
        title: b.title,
        description: b.description,
        location: b.location,
        startAt: b.startAt ? new Date(b.startAt) : undefined,
        endAt: b.endAt ? new Date(b.endAt) : undefined,
        allDay: b.allDay,
      })
      if (!event) return reply.code(404).send({ error: 'Not found' })
      return event
    },
  )

  app.delete<{ Params: { id: string } }>(
    '/calendar/events/:id',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const ok = await deleteEvent(accountId, req.params.id)
      if (!ok) return reply.code(404).send({ error: 'Not found' })
      return reply.code(204).send()
    },
  )

  // ── App passwords (for CalDAV client auth) ─────────────────────────────────

  app.get('/calendar/app-passwords', async (req) => {
    const accountId = (req as any).accountId as string
    return listAppPasswords(accountId)
  })

  app.post<{ Body: { label: string } }>(
    '/calendar/app-passwords',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      if (!req.body.label?.trim()) return reply.code(400).send({ error: 'label required' })
      const pw = await createAppPassword(accountId, req.body.label)
      return reply.code(201).send(pw)
    },
  )

  app.delete<{ Params: { id: string } }>(
    '/calendar/app-passwords/:id',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const ok = await deleteAppPassword(accountId, req.params.id)
      if (!ok) return reply.code(404).send({ error: 'Not found' })
      return reply.code(204).send()
    },
  )
}
