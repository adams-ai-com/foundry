import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { makeApp, createTestAccount, deleteTestAccount, inject } from './helpers.js'
import { sql } from '../db.js'

let app: FastifyInstance
let accountId: string

beforeAll(async () => {
  app = await makeApp()
  const acct = await createTestAccount('calendar')
  accountId = acct.id
})

afterAll(async () => {
  await deleteTestAccount(accountId)
  await app.close()
  await sql.end()
})

function futureDate(daysOut: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOut)
  return d.toISOString()
}

describe('GET /api/v1/calendar/events', () => {
  it('returns empty list for new account', async () => {
    const res = await inject(app, 'GET', '/api/v1/calendar/events', { accountId })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
  })
})

describe('POST /api/v1/calendar/events', () => {
  it('creates a simple event', async () => {
    const res = await inject(app, 'POST', '/api/v1/calendar/events', {
      accountId,
      body: {
        title: 'Team meeting',
        startAt: futureDate(1),
        endAt: futureDate(1),
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBeTruthy()
  })

  it('creates an all-day event', async () => {
    const res = await inject(app, 'POST', '/api/v1/calendar/events', {
      accountId,
      body: {
        title: 'Company holiday',
        startAt: futureDate(7),
        endAt: futureDate(7),
        allDay: true,
      },
    })
    expect(res.statusCode).toBe(200)
  })

  it('creates an event with attendees', async () => {
    const res = await inject(app, 'POST', '/api/v1/calendar/events', {
      accountId,
      body: {
        title: 'Planning session',
        startAt: futureDate(3),
        endAt: futureDate(3),
        location: 'Conference Room A',
        attendees: [
          { name: 'Alice', email: 'alice@example.com' },
          { email: 'bob@example.com' },
        ],
      },
    })
    expect(res.statusCode).toBe(200)
  })

  it('appears in GET listing after creation', async () => {
    const title = `Event-${Date.now()}`
    await inject(app, 'POST', '/api/v1/calendar/events', {
      accountId,
      body: { title, startAt: futureDate(5), endAt: futureDate(5) },
    })

    const list = await inject(app, 'GET', '/api/v1/calendar/events', { accountId })
    const titles = list.json().map((e: any) => e.title)
    expect(titles).toContain(title)
  })
})

describe('start/end filtering', () => {
  it('respects start filter', async () => {
    const farFuture = new Date()
    farFuture.setFullYear(farFuture.getFullYear() + 5)
    const start = farFuture.toISOString()
    const end = new Date(farFuture.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const res = await inject(
      app, 'GET',
      `/api/v1/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      { accountId },
    )
    expect(res.statusCode).toBe(200)
    // No events in that far-future window
    expect(res.json()).toHaveLength(0)
  })
})

describe('PATCH /api/v1/calendar/events/:id', () => {
  it('updates an event title', async () => {
    const created = await inject(app, 'POST', '/api/v1/calendar/events', {
      accountId,
      body: { title: 'Old title', startAt: futureDate(2), endAt: futureDate(2) },
    })
    const id = created.json().id

    const res = await inject(app, 'PATCH', `/api/v1/calendar/events/${id}`, {
      accountId,
      body: { title: 'New title' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })

  it('rejects empty patch body', async () => {
    const created = await inject(app, 'POST', '/api/v1/calendar/events', {
      accountId,
      body: { title: 'Patch empty test', startAt: futureDate(2), endAt: futureDate(2) },
    })
    const id = created.json().id

    const res = await inject(app, 'PATCH', `/api/v1/calendar/events/${id}`, {
      accountId,
      body: {},
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('DELETE /api/v1/calendar/events/:id', () => {
  it('deletes an event', async () => {
    const title = `Delete-${Date.now()}`
    const created = await inject(app, 'POST', '/api/v1/calendar/events', {
      accountId,
      body: { title, startAt: futureDate(4), endAt: futureDate(4) },
    })
    const id = created.json().id

    const del = await inject(app, 'DELETE', `/api/v1/calendar/events/${id}`, { accountId })
    expect(del.statusCode).toBe(200)
    expect(del.json().ok).toBe(true)

    const list = await inject(app, 'GET', '/api/v1/calendar/events', { accountId })
    const ids = list.json().map((e: any) => e.id)
    expect(ids).not.toContain(id)
  })
})
