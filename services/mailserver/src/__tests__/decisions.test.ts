import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { makeApp, createTestAccount, deleteTestAccount, inject } from './helpers.js'
import { sql } from '../db.js'

let app: FastifyInstance
let accountId: string

beforeAll(async () => {
  app = await makeApp()
  const acct = await createTestAccount('decisions')
  accountId = acct.id
})

afterAll(async () => {
  await deleteTestAccount(accountId)
  await app.close()
  await sql.end()
})

describe('GET /api/v1/decisions', () => {
  it('returns empty list for new account', async () => {
    const res = await inject(app, 'GET', '/api/v1/decisions', { accountId })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.decisions).toEqual([])
    expect(body.total).toBe(0)
  })
})

describe('POST /api/v1/decisions', () => {
  it('creates a decision with required fields', async () => {
    const res = await inject(app, 'POST', '/api/v1/decisions', {
      accountId,
      body: {
        subject: 'Use PostgreSQL',
        outcome: 'We will use PostgreSQL as the primary database.',
      },
    })
    expect(res.statusCode).toBe(201)
    const d = res.json()
    expect(d.id).toBeTruthy()
    expect(d.subject).toBe('Use PostgreSQL')
    expect(d.outcome).toBe('We will use PostgreSQL as the primary database.')
    expect(d.decided_at ?? d.decidedAt).toBeTruthy()
  })

  it('creates a decision with all optional fields', async () => {
    const res = await inject(app, 'POST', '/api/v1/decisions', {
      accountId,
      body: {
        subject: 'Monorepo structure',
        outcome: 'All apps share packages via pnpm workspace.',
        decidedBy: 'john@example.com',
        decidedAt: '2025-01-15',
      },
    })
    expect(res.statusCode).toBe(201)
    const d = res.json()
    expect(d.decided_by ?? d.decidedBy).toBe('john@example.com')
  })

  it('rejects missing subject', async () => {
    const res = await inject(app, 'POST', '/api/v1/decisions', {
      accountId,
      body: { outcome: 'some outcome' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects missing outcome', async () => {
    const res = await inject(app, 'POST', '/api/v1/decisions', {
      accountId,
      body: { subject: 'some subject' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/v1/decisions/:id', () => {
  it('returns a decision by id', async () => {
    const created = await inject(app, 'POST', '/api/v1/decisions', {
      accountId,
      body: { subject: 'Find by id', outcome: 'It works.' },
    })
    const id = created.json().id

    const res = await inject(app, 'GET', `/api/v1/decisions/${id}`, { accountId })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(id)
    expect(res.json().subject).toBe('Find by id')
  })

  it('returns 404 for unknown id', async () => {
    const res = await inject(app, 'GET', '/api/v1/decisions/nonexistent', { accountId })
    expect(res.statusCode).toBe(404)
  })

  it('cannot read another account decision', async () => {
    const other = await createTestAccount('decisions-iso')
    try {
      const created = await inject(app, 'POST', '/api/v1/decisions', {
        accountId: other.id,
        body: { subject: 'Private', outcome: 'Private outcome.' },
      })
      const id = created.json().id

      const res = await inject(app, 'GET', `/api/v1/decisions/${id}`, { accountId })
      expect(res.statusCode).toBe(404)
    } finally {
      await deleteTestAccount(other.id)
    }
  })
})

describe('PATCH /api/v1/decisions/:id', () => {
  it('updates subject and outcome', async () => {
    const created = await inject(app, 'POST', '/api/v1/decisions', {
      accountId,
      body: { subject: 'Old subject', outcome: 'Old outcome.' },
    })
    const id = created.json().id

    const res = await inject(app, 'PATCH', `/api/v1/decisions/${id}`, {
      accountId,
      body: { subject: 'New subject', outcome: 'New outcome.' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().subject).toBe('New subject')
    expect(res.json().outcome).toBe('New outcome.')
  })

  it('returns 404 for nonexistent decision', async () => {
    const res = await inject(app, 'PATCH', '/api/v1/decisions/nonexistent', {
      accountId,
      body: { subject: 'x' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/v1/decisions/:id', () => {
  it('deletes a decision and it cannot be found after', async () => {
    const created = await inject(app, 'POST', '/api/v1/decisions', {
      accountId,
      body: { subject: 'Delete me', outcome: 'Outcome.' },
    })
    const id = created.json().id

    const del = await inject(app, 'DELETE', `/api/v1/decisions/${id}`, { accountId })
    expect(del.statusCode).toBe(204)

    const fetch = await inject(app, 'GET', `/api/v1/decisions/${id}`, { accountId })
    expect(fetch.statusCode).toBe(404)
  })

  it('returns 404 for nonexistent decision', async () => {
    const res = await inject(app, 'DELETE', '/api/v1/decisions/nonexistent', { accountId })
    expect(res.statusCode).toBe(404)
  })
})

describe('pagination', () => {
  it('page param returns subset of results', async () => {
    // Create 3 decisions
    await Promise.all([
      inject(app, 'POST', '/api/v1/decisions', { accountId, body: { subject: 'D1', outcome: 'O1' } }),
      inject(app, 'POST', '/api/v1/decisions', { accountId, body: { subject: 'D2', outcome: 'O2' } }),
      inject(app, 'POST', '/api/v1/decisions', { accountId, body: { subject: 'D3', outcome: 'O3' } }),
    ])

    const res = await inject(app, 'GET', '/api/v1/decisions?page=1', { accountId })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.decisions.length).toBeGreaterThanOrEqual(3)
    expect(body.total).toBeGreaterThanOrEqual(3)
  })
})
