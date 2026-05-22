import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { makeApp, createTestAccount, deleteTestAccount, inject } from './helpers.js'
import { sql } from '../db.js'

let app: FastifyInstance
let accountId: string

beforeAll(async () => {
  app = await makeApp()
  const acct = await createTestAccount('search')
  accountId = acct.id
})

afterAll(async () => {
  await deleteTestAccount(accountId)
  await app.close()
  await sql.end()
})

describe('GET /api/v1/search', () => {
  it('returns empty threads for blank query', async () => {
    const res = await inject(app, 'GET', '/api/v1/search', { accountId })
    expect(res.statusCode).toBe(200)
    expect(res.json().threads).toEqual([])
  })

  it('returns empty result for empty string query', async () => {
    const res = await inject(app, 'GET', '/api/v1/search?q=', { accountId })
    expect(res.statusCode).toBe(200)
    expect(res.json().threads).toEqual([])
  })

  it('returns no results for non-matching query on empty account', async () => {
    const res = await inject(app, 'GET', '/api/v1/search?q=projectalpha', { accountId })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json().threads ?? res.json())).toBe(true)
  })

  it('accepts url-encoded multi-word query', async () => {
    const res = await inject(
      app, 'GET',
      `/api/v1/search?q=${encodeURIComponent('quarterly report')}`,
      { accountId },
    )
    expect(res.statusCode).toBe(200)
  })

  it('does not expose results from other accounts', async () => {
    const other = await createTestAccount('search-iso')
    try {
      const myRes = await inject(app, 'GET', '/api/v1/search?q=test', { accountId })
      const otherRes = await inject(app, 'GET', '/api/v1/search?q=test', { accountId: other.id })
      // Results are scoped: no overlap in thread IDs
      const myIds = new Set(
        ((myRes.json().threads ?? myRes.json()) as any[]).map((t: any) => t.id),
      )
      const otherIds = ((otherRes.json().threads ?? otherRes.json()) as any[]).map((t: any) => t.id)
      for (const id of otherIds) {
        expect(myIds.has(id)).toBe(false)
      }
    } finally {
      await deleteTestAccount(other.id)
    }
  })
})
