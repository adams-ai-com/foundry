import { test, expect } from '@playwright/test'
import { randomUUID } from 'crypto'
import { mintSession } from '@foundry/e2e'

const BASE = 'http://127.0.0.1:3007'

test.describe('sites', () => {
  test('health endpoint answers', async ({ request }) => {
    const res = await request.get(`${BASE}/sites/api/health`)
    expect([200, 404]).toContain(res.status())
  })

  test('upload rejects a request with no file', async ({ request }) => {
    const sess = await mintSession()
    const res = await request.post(`${BASE}/sites/api/upload`, {
      headers: { cookie: `foundry_session=${sess}` },
      multipart: { siteId: 'nonexistent' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  test('unknown file id is a clean 404', async ({ request }) => {
    const sess = await mintSession()
    const res = await request.get(`${BASE}/sites/api/file/${randomUUID()}`, {
      headers: { cookie: `foundry_session=${sess}` },
    })
    expect([404, 400]).toContain(res.status())
  })
})
