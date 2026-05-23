import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { makeApp, createTestAccount, deleteTestAccount, inject } from './helpers.js'
import { sql } from '../db.js'

let app: FastifyInstance
let accountId: string

beforeAll(async () => {
  app = await makeApp()
  const acct = await createTestAccount('contacts')
  accountId = acct.id
})

afterAll(async () => {
  await deleteTestAccount(accountId)
  await app.close()
  await sql.end()
})

describe('GET /api/v1/contacts', () => {
  it('returns empty list for new account', async () => {
    const res = await inject(app, 'GET', '/api/v1/contacts', { accountId })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
    expect(res.json()).toHaveLength(0)
  })
})

describe('POST /api/v1/contacts', () => {
  it('creates a contact with just email', async () => {
    const res = await inject(app, 'POST', '/api/v1/contacts', {
      accountId,
      body: { email: 'simple@example.com' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBeTruthy()
  })

  it('creates a contact with all fields', async () => {
    const res = await inject(app, 'POST', '/api/v1/contacts', {
      accountId,
      body: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-1234',
        org: 'ACME Corp',
        notes: 'Key contact',
      },
    })
    expect(res.statusCode).toBe(200)
  })

  it('rejects missing email', async () => {
    const res = await inject(app, 'POST', '/api/v1/contacts', {
      accountId,
      body: { name: 'No Email Person' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('upserts on duplicate email within same account', async () => {
    await inject(app, 'POST', '/api/v1/contacts', {
      accountId,
      body: { email: 'upsert@example.com', name: 'Original Name' },
    })
    const res = await inject(app, 'POST', '/api/v1/contacts', {
      accountId,
      body: { email: 'upsert@example.com', name: 'Updated Name' },
    })
    expect(res.statusCode).toBe(200)

    const list = await inject(app, 'GET', '/api/v1/contacts', { accountId })
    const contacts = list.json()
    const dup = contacts.filter((c: any) => c.email === 'upsert@example.com')
    expect(dup).toHaveLength(1)
  })
})

describe('GET /api/v1/contacts?q=', () => {
  beforeAll(async () => {
    // Seed contacts for search
    await inject(app, 'POST', '/api/v1/contacts', {
      accountId,
      body: { name: 'Alice Smith', email: 'alice@smith.com', org: 'Smith Corp' },
    })
    await inject(app, 'POST', '/api/v1/contacts', {
      accountId,
      body: { name: 'Bob Jones', email: 'bob@jones.com', org: 'Jones LLC' },
    })
  })

  it('finds contact by name substring', async () => {
    const res = await inject(app, 'GET', '/api/v1/contacts?q=Alice', { accountId })
    expect(res.statusCode).toBe(200)
    const results = res.json()
    expect(results.some((c: any) => c.name === 'Alice Smith')).toBe(true)
    expect(results.some((c: any) => c.name === 'Bob Jones')).toBe(false)
  })

  it('finds contact by email substring', async () => {
    const res = await inject(app, 'GET', '/api/v1/contacts?q=bob%40jones', { accountId })
    expect(res.statusCode).toBe(200)
    const results = res.json()
    expect(results.some((c: any) => c.email === 'bob@jones.com')).toBe(true)
  })

  it('returns empty array for no match', async () => {
    const res = await inject(app, 'GET', '/api/v1/contacts?q=zzznomatch', { accountId })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(0)
  })
})
