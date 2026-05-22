import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { makeApp, createTestAccount, deleteTestAccount } from './helpers.js'
import { sql } from '../db.js'

let app: FastifyInstance
let accountId: string

beforeAll(async () => {
  app = await makeApp()
  const acct = await createTestAccount('auth')
  accountId = acct.id
})

afterAll(async () => {
  await deleteTestAccount(accountId)
  await app.close()
  await sql.end()
})

describe('health endpoint', () => {
  it('returns ok without auth headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.service).toBe('foundry-mailserver')
  })
})

describe('auth middleware', () => {
  it('rejects missing api key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/mailboxes',
      headers: { 'x-account-id': accountId },
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects wrong api key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/mailboxes',
      headers: { 'x-api-key': 'wrong-key', 'x-account-id': accountId },
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects missing account id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/mailboxes',
      headers: { 'x-api-key': 'test-key' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects unknown account id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/mailboxes',
      headers: { 'x-api-key': 'test-key', 'x-account-id': 'nonexistent-account' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('accepts valid key + account id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/mailboxes',
      headers: { 'x-api-key': 'test-key', 'x-account-id': accountId },
    })
    expect(res.statusCode).toBe(200)
  })
})
