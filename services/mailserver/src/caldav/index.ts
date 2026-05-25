import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sql } from '../db.js'
import {
  getOrCreateDefaultCalendar, listCalendars, getCalendar,
  listEvents, getEventByUid, upsertEventByUid, deleteEventByUid,
  verifyAppPassword,
} from '../storage/calendars.js'
import { serializeEvent, parseIcal } from './ical.js'
import * as xml from './xml.js'

// ── Auth ──────────────────────────────────────────────────────────────────────

async function authenticate(req: FastifyRequest): Promise<{ accountId: string; email: string } | null> {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Basic ')) return null
  const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf-8')
  const colon = decoded.indexOf(':')
  if (colon < 0) return null
  const token = decoded.slice(colon + 1)
  return verifyAppPassword(token)
}

// ── URL helpers ───────────────────────────────────────────────────────────────

function caldavBase(req: FastifyRequest): string {
  const proto = req.headers['x-forwarded-proto'] ?? 'https'
  const host = req.headers['x-forwarded-host'] ?? req.headers.host
  return `${proto}://${host}`
}

function principalHref(base: string, email: string): string {
  return `/caldav/${encodeURIComponent(email)}/`
}

function calendarHomeHref(base: string, email: string): string {
  return `/caldav/${encodeURIComponent(email)}/calendars/`
}

function calendarHref(email: string, calId: string): string {
  return `/caldav/${encodeURIComponent(email)}/calendars/${calId}/`
}

function eventHref(email: string, calId: string, uid: string): string {
  return `/caldav/${encodeURIComponent(email)}/calendars/${calId}/${encodeURIComponent(uid)}.ics`
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export async function caldavPlugin(app: FastifyInstance) {
  const XML_CT = 'application/xml; charset=utf-8'
  const ICAL_CT = 'text/calendar; charset=utf-8'

  // Parse XML and iCal bodies as raw strings — Fastify doesn't know these types by default
  const rawParser = (_req: FastifyRequest, body: string, done: (err: null, body: string) => void) => done(null, body)
  app.addContentTypeParser('application/xml', { parseAs: 'string' }, rawParser)
  app.addContentTypeParser('text/xml', { parseAs: 'string' }, rawParser)
  app.addContentTypeParser('text/calendar', { parseAs: 'string' }, rawParser)

  // ── well-known redirect ──────────────────────────────────────────────────

  app.get('/.well-known/caldav', async (req, reply) => {
    reply.redirect('/caldav/', 301)
  })

  // ── OPTIONS (capability advertisement) ──────────────────────────────────

  app.options('/caldav/*', async (req, reply) => {
    reply.headers(xml.optionsHeaders()).code(200).send('')
  })
  app.options('/caldav/', async (req, reply) => {
    reply.headers(xml.optionsHeaders()).code(200).send('')
  })

  // ── PROPFIND dispatcher ──────────────────────────────────────────────────

  // @ts-ignore — custom method added in api/index.ts
  app.propfind('/.well-known/caldav', async (req, reply) => {
    reply.redirect('/caldav/', 301)
  })

  // @ts-ignore
  app.propfind('/caldav/', async (req, reply) => {
    const auth = await authenticate(req)
    if (!auth) return reply.code(401).header('WWW-Authenticate', 'Basic realm="Foundry CalDAV"').send()
    const principal = principalHref(caldavBase(req), auth.email)
    reply
      .code(207)
      .header('Content-Type', XML_CT)
      .send(xml.currentUserPrincipal('/caldav/', principal))
  })

  // @ts-ignore
  app.propfind('/caldav/:username/', async (req: FastifyRequest<{ Params: { username: string } }>, reply) => {
    const auth = await authenticate(req)
    if (!auth) return reply.code(401).header('WWW-Authenticate', 'Basic realm="Foundry CalDAV"').send()

    const base = caldavBase(req)
    const principal = principalHref(base, auth.email)
    const calHome = calendarHomeHref(base, auth.email)
    reply
      .code(207)
      .header('Content-Type', XML_CT)
      .send(xml.principalResponse(principal, auth.email, calHome))
  })

  // @ts-ignore
  app.propfind('/caldav/:username/calendars/', async (req: FastifyRequest<{ Params: { username: string } }>, reply) => {
    const auth = await authenticate(req)
    if (!auth) return reply.code(401).header('WWW-Authenticate', 'Basic realm="Foundry CalDAV"').send()

    await getOrCreateDefaultCalendar(auth.accountId)
    const calendars = await listCalendars(auth.accountId)
    const homeHref = calendarHomeHref(caldavBase(req), auth.email)

    const calDescs = calendars.map((cal) => ({
      id: cal.id,
      name: cal.name,
      color: cal.color,
      ctag: cal.ctag || '0',
      href: calendarHref(auth.email, cal.id),
    }))

    reply
      .code(207)
      .header('Content-Type', XML_CT)
      .send(xml.calendarHomeResponse(homeHref, calDescs))
  })

  // @ts-ignore
  app.propfind('/caldav/:username/calendars/:calId/', async (
    req: FastifyRequest<{ Params: { username: string; calId: string } }>,
    reply,
  ) => {
    const auth = await authenticate(req)
    if (!auth) return reply.code(401).header('WWW-Authenticate', 'Basic realm="Foundry CalDAV"').send()

    const cal = await getCalendar(auth.accountId, req.params.calId)
    if (!cal) return reply.code(404).header('Content-Type', XML_CT).send(xml.notFound(req.url))

    const depth = (req.headers['depth'] as string) ?? '0'
    const events = depth === '1' ? await listEvents(auth.accountId, { calendarId: cal.id }) : []

    const calDesc = { id: cal.id, name: cal.name, color: cal.color, ctag: cal.ctag || '0', href: calendarHref(auth.email, cal.id) }
    const eventDescs = events.map((e) => ({
      uid: e.icalUid ?? e.id,
      etag: e.etag,
      href: eventHref(auth.email, cal.id, e.icalUid ?? e.id),
    }))

    reply
      .code(207)
      .header('Content-Type', XML_CT)
      .send(xml.calendarResponse(calDesc.href, calDesc, eventDescs, false))
  })

  // @ts-ignore
  app.propfind('/caldav/:username/calendars/:calId/:uid', async (
    req: FastifyRequest<{ Params: { username: string; calId: string; uid: string } }>,
    reply,
  ) => {
    const auth = await authenticate(req)
    if (!auth) return reply.code(401).header('WWW-Authenticate', 'Basic realm="Foundry CalDAV"').send()

    const uid = req.params.uid.replace(/\.ics$/, '')
    const event = await getEventByUid(auth.accountId, decodeURIComponent(uid))
    if (!event) return reply.code(404).header('Content-Type', XML_CT).send(xml.notFound(req.url))

    reply
      .code(207)
      .header('Content-Type', XML_CT)
      .send(xml.eventPropfindResponse(req.url, event.etag))
  })

  // ── REPORT (calendar-query / multiget) ───────────────────────────────────

  // @ts-ignore
  app.report('/caldav/:username/calendars/:calId/', async (
    req: FastifyRequest<{ Params: { username: string; calId: string } }>,
    reply,
  ) => {
    const auth = await authenticate(req)
    if (!auth) return reply.code(401).header('WWW-Authenticate', 'Basic realm="Foundry CalDAV"').send()

    const cal = await getCalendar(auth.accountId, req.params.calId)
    if (!cal) return reply.code(404).header('Content-Type', XML_CT).send(xml.notFound(req.url))

    // Parse date range from the REPORT body if present (calendar-query)
    const body = (req.body as string) ?? ''
    let start: Date | undefined
    let end: Date | undefined

    const startMatch = body.match(/<C:time-range[^>]+start="([^"]+)"/)
    const endMatch = body.match(/end="([^"]+)"/)
    if (startMatch) start = new Date(startMatch[1])
    if (endMatch) end = new Date(endMatch[1])

    // Check if this is a multiget (specific hrefs requested)
    const hrefMatches = [...body.matchAll(/<D:href>([^<]+)<\/D:href>/g)]
    let events

    if (hrefMatches.length > 0) {
      const uids = hrefMatches
        .map((m) => decodeURIComponent(m[1].split('/').pop()?.replace(/\.ics$/, '') ?? ''))
        .filter(Boolean)
      events = await Promise.all(uids.map((uid) => getEventByUid(auth.accountId, uid)))
      events = events.filter(Boolean)
    } else {
      events = await listEvents(auth.accountId, { calendarId: cal.id, start, end })
    }

    const descs = (events as NonNullable<typeof events[number]>[]).map((e) => ({
      uid: e.icalUid ?? e.id,
      etag: e.etag,
      href: eventHref(auth.email, cal.id, e.icalUid ?? e.id),
      calendarData: serializeEvent(e),
    }))

    reply
      .code(207)
      .header('Content-Type', XML_CT)
      .send(xml.reportResponse(descs))
  })

  // ── GET (fetch a single event) ───────────────────────────────────────────

  app.get('/caldav/:username/calendars/:calId/:uid', async (
    req: FastifyRequest<{ Params: { username: string; calId: string; uid: string } }>,
    reply,
  ) => {
    const auth = await authenticate(req)
    if (!auth) return reply.code(401).header('WWW-Authenticate', 'Basic realm="Foundry CalDAV"').send()

    const uid = decodeURIComponent(req.params.uid.replace(/\.ics$/, ''))
    const event = await getEventByUid(auth.accountId, uid)
    if (!event) return reply.code(404).send()

    reply
      .code(200)
      .header('Content-Type', ICAL_CT)
      .header('ETag', `"${event.etag}"`)
      .send(serializeEvent(event))
  })

  // ── PUT (create or update an event) ─────────────────────────────────────

  app.put('/caldav/:username/calendars/:calId/:uid', async (
    req: FastifyRequest<{ Params: { username: string; calId: string; uid: string } }>,
    reply,
  ) => {
    const auth = await authenticate(req)
    if (!auth) return reply.code(401).header('WWW-Authenticate', 'Basic realm="Foundry CalDAV"').send()

    const cal = await getCalendar(auth.accountId, req.params.calId)
    if (!cal) return reply.code(404).send()

    // If-Match / If-None-Match for conditional updates
    const ifMatch = req.headers['if-match']
    if (ifMatch && ifMatch !== '*') {
      const uid = decodeURIComponent(req.params.uid.replace(/\.ics$/, ''))
      const existing = await getEventByUid(auth.accountId, uid)
      if (existing && `"${existing.etag}"` !== ifMatch) {
        return reply.code(412).send()
      }
    }

    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    const parsed = parseIcal(body)
    if (!parsed) return reply.code(400).send({ error: 'Invalid iCal data' })

    const event = await upsertEventByUid(auth.accountId, cal.id, {
      uid: parsed.uid,
      title: parsed.title,
      description: parsed.description,
      location: parsed.location,
      startAt: parsed.startAt,
      endAt: parsed.endAt,
      allDay: parsed.allDay,
      attendees: parsed.attendees,
      organizerEmail: parsed.organizerEmail,
      rrule: parsed.rrule,
      sequence: parsed.sequence,
    })

    const isNew = !ifMatch
    reply
      .code(isNew ? 201 : 204)
      .header('ETag', `"${event.etag}"`)
      .send()
  })

  // ── DELETE (remove an event) ─────────────────────────────────────────────

  app.delete('/caldav/:username/calendars/:calId/:uid', async (
    req: FastifyRequest<{ Params: { username: string; calId: string; uid: string } }>,
    reply,
  ) => {
    const auth = await authenticate(req)
    if (!auth) return reply.code(401).header('WWW-Authenticate', 'Basic realm="Foundry CalDAV"').send()

    const uid = decodeURIComponent(req.params.uid.replace(/\.ics$/, ''))
    const deleted = await deleteEventByUid(auth.accountId, uid)
    reply.code(deleted ? 204 : 404).send()
  })
}
