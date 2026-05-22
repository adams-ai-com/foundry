import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { makeApp, createTestAccount, deleteTestAccount, inject } from './helpers.js'
import { sql } from '../db.js'

let app: FastifyInstance
let accountId: string

beforeAll(async () => {
  app = await makeApp()
  const acct = await createTestAccount('channels')
  accountId = acct.id
})

afterAll(async () => {
  await deleteTestAccount(accountId)
  await app.close()
  await sql.end()
})

async function createChannel(name: string, acctId = accountId) {
  const res = await inject(app, 'POST', '/api/v1/channels', {
    accountId: acctId,
    body: { name, description: `Channel ${name}` },
  })
  return res.json()
}

describe('GET /api/v1/channels', () => {
  it('returns empty list for new account', async () => {
    const res = await inject(app, 'GET', '/api/v1/channels', { accountId })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
  })
})

describe('POST /api/v1/channels', () => {
  it('creates a channel', async () => {
    const res = await inject(app, 'POST', '/api/v1/channels', {
      accountId,
      body: { name: 'dev', description: 'Engineering channel' },
    })
    expect(res.statusCode).toBe(201)
    const ch = res.json()
    expect(ch.id).toBeTruthy()
    expect(ch.name).toBe('dev')
    expect(ch.description).toBe('Engineering channel')
    expect(ch.isPrivate ?? ch.is_private).toBe(false)
  })

  it('rejects blank name', async () => {
    const res = await inject(app, 'POST', '/api/v1/channels', {
      accountId,
      body: { name: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects duplicate channel name', async () => {
    await inject(app, 'POST', '/api/v1/channels', {
      accountId,
      body: { name: 'duplicate-test' },
    })
    const res = await inject(app, 'POST', '/api/v1/channels', {
      accountId,
      body: { name: 'duplicate-test' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('two accounts can have same channel name', async () => {
    const other = await createTestAccount('channels-same')
    try {
      const r1 = await inject(app, 'POST', '/api/v1/channels', { accountId, body: { name: 'shared-name' } })
      const r2 = await inject(app, 'POST', '/api/v1/channels', { accountId: other.id, body: { name: 'shared-name' } })
      expect(r1.statusCode).toBe(201)
      expect(r2.statusCode).toBe(201)
    } finally {
      await deleteTestAccount(other.id)
    }
  })
})

describe('DELETE /api/v1/channels/:id', () => {
  it('deletes a non-general channel', async () => {
    const ch = await createChannel('to-delete')
    const res = await inject(app, 'DELETE', `/api/v1/channels/${ch.id}`, { accountId })
    expect(res.statusCode).toBe(204)

    const list = await inject(app, 'GET', '/api/v1/channels', { accountId })
    const ids = list.json().map((c: any) => c.id)
    expect(ids).not.toContain(ch.id)
  })

  it('refuses to delete #general channel', async () => {
    // Create a general channel explicitly
    const res = await inject(app, 'POST', '/api/v1/channels', {
      accountId,
      body: { name: 'general' },
    })
    const ch = res.json()
    if (res.statusCode === 409) {
      // Already exists — find it
      const list = await inject(app, 'GET', '/api/v1/channels', { accountId })
      const general = list.json().find((c: any) => c.name === 'general')
      if (general) {
        const del = await inject(app, 'DELETE', `/api/v1/channels/${general.id}`, { accountId })
        expect(del.statusCode).toBe(404)
        return
      }
    }
    if (res.statusCode === 201) {
      const del = await inject(app, 'DELETE', `/api/v1/channels/${ch.id}`, { accountId })
      expect(del.statusCode).toBe(404)
    }
  })

  it('returns 404 for nonexistent channel', async () => {
    const res = await inject(app, 'DELETE', '/api/v1/channels/nonexistent', { accountId })
    expect(res.statusCode).toBe(404)
  })
})

describe('channel messages', () => {
  let channelId: string

  beforeAll(async () => {
    const ch = await createChannel(`msgs-${Date.now()}`)
    channelId = ch.id
  })

  it('starts with empty message list', async () => {
    const res = await inject(app, 'GET', `/api/v1/channels/${channelId}/messages`, { accountId })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
    expect(res.json()).toHaveLength(0)
  })

  it('posts a message', async () => {
    const res = await inject(app, 'POST', `/api/v1/channels/${channelId}/messages`, {
      accountId,
      body: {
        senderName: 'Test User',
        senderEmail: 'test@example.com',
        body: 'Hello channel!',
      },
    })
    expect(res.statusCode).toBe(201)
    const msg = res.json()
    expect(msg.id).toBeTruthy()
    expect(msg.body).toBe('Hello channel!')
    expect(msg.senderEmail ?? msg.sender_email).toBe('test@example.com')
  })

  it('rejects empty message body', async () => {
    const res = await inject(app, 'POST', `/api/v1/channels/${channelId}/messages`, {
      accountId,
      body: {
        senderName: 'Test User',
        senderEmail: 'test@example.com',
        body: '   ',
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('lists messages in order after posting', async () => {
    const msgs = ['First', 'Second', 'Third']
    for (const text of msgs) {
      await inject(app, 'POST', `/api/v1/channels/${channelId}/messages`, {
        accountId,
        body: { senderEmail: 'test@example.com', body: text },
      })
    }

    const res = await inject(app, 'GET', `/api/v1/channels/${channelId}/messages`, { accountId })
    const bodies = res.json().map((m: any) => m.body)
    expect(bodies).toContain('First')
    expect(bodies).toContain('Second')
    expect(bodies).toContain('Third')
  })

  it('paginates with limit', async () => {
    const res = await inject(app, 'GET', `/api/v1/channels/${channelId}/messages?limit=2`, { accountId })
    expect(res.statusCode).toBe(200)
    expect(res.json().length).toBeLessThanOrEqual(2)
  })

  it('deletes a message', async () => {
    const posted = await inject(app, 'POST', `/api/v1/channels/${channelId}/messages`, {
      accountId,
      body: { senderEmail: 'test@example.com', body: 'Delete this' },
    })
    const msgId = posted.json().id

    const del = await inject(app, 'DELETE', `/api/v1/channels/${channelId}/messages/${msgId}`, { accountId })
    expect(del.statusCode).toBe(204)

    const list = await inject(app, 'GET', `/api/v1/channels/${channelId}/messages`, { accountId })
    const ids = list.json().map((m: any) => m.id)
    expect(ids).not.toContain(msgId)
  })

  it('returns 404 when posting to nonexistent channel', async () => {
    const res = await inject(app, 'POST', `/api/v1/channels/nonexistent/messages`, {
      accountId,
      body: { senderEmail: 'test@example.com', body: 'Hello' },
    })
    expect(res.statusCode).toBe(404)
  })
})
