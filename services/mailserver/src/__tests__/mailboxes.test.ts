import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { makeApp, createTestAccount, deleteTestAccount, inject } from './helpers.js'
import { sql } from '../db.js'

let app: FastifyInstance
let accountId: string

beforeAll(async () => {
  app = await makeApp()
  const acct = await createTestAccount('mailboxes')
  accountId = acct.id
})

afterAll(async () => {
  await deleteTestAccount(accountId)
  await app.close()
  await sql.end()
})

describe('GET /api/v1/mailboxes', () => {
  it('returns all system mailboxes for a new account', async () => {
    const res = await inject(app, 'GET', '/api/v1/mailboxes', { accountId })
    expect(res.statusCode).toBe(200)
    const boxes = res.json()
    expect(Array.isArray(boxes)).toBe(true)

    const paths = boxes.map((b: any) => b.path)
    expect(paths).toContain('inbox')
    expect(paths).toContain('sent')
    expect(paths).toContain('drafts')
    expect(paths).toContain('archive')
    expect(paths).toContain('trash')
    expect(paths).toContain('spam')
  })

  it('mailboxes have required fields', async () => {
    const res = await inject(app, 'GET', '/api/v1/mailboxes', { accountId })
    const boxes = res.json()
    expect(boxes.length).toBeGreaterThan(0)
    for (const box of boxes) {
      expect(box).toHaveProperty('id')
      expect(box).toHaveProperty('path')
      expect(box).toHaveProperty('name')
      expect(box).toHaveProperty('totalCount')
      expect(box).toHaveProperty('unreadCount')
    }
  })

  it('does not expose other accounts mailboxes', async () => {
    const other = await createTestAccount('mailboxes-other')
    try {
      const res = await inject(app, 'GET', '/api/v1/mailboxes', { accountId: other.id })
      const otherBoxes = res.json()

      const myRes = await inject(app, 'GET', '/api/v1/mailboxes', { accountId })
      const myBoxes = myRes.json()

      const myIds = new Set(myBoxes.map((b: any) => b.id))
      const otherIds = otherBoxes.map((b: any) => b.id)
      for (const id of otherIds) {
        expect(myIds.has(id)).toBe(false)
      }
    } finally {
      await deleteTestAccount(other.id)
    }
  })
})
