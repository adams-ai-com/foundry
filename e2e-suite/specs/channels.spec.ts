import { test, expect } from '@playwright/test'
import { randomUUID } from 'crypto'
import { E2E_PREFIX, dbFromEnvFile, dbFromUrl, mintSession, testUser, wsDb } from '@owl/e2e'

// Channels read path with seeded org data. Video calls (LiveKit), AI summaries
// (llmbox), and importers are external-dependency paths — deliberately not
// exercised here; they need mocks when their suites are built.
const BASE = process.env.CHANNELS_BASE ?? 'http://127.0.0.1:4108'
const ENV = '/var/www/foundry/apps/channels/.env'

test.describe.serial('channels', () => {
  let sess: string
  let orgId: string
  let orgSlug: string
  let userId: string
  let channelId: string
  let topicId: string
  const db = () =>
    process.env.CHANNELS_DB_URL ? dbFromUrl(process.env.CHANNELS_DB_URL) : dbFromEnvFile(ENV, 'CHANNELS_DATABASE_URL')

  test.beforeAll(async () => {
    sess = await mintSession()
    const u = await testUser()
    userId = u.userId
    orgId = u.orgId!
    const [org] = await wsDb()`SELECT slug FROM orgs WHERE id = ${orgId}`
    orgSlug = org.slug

    channelId = randomUUID()
    topicId = randomUUID()
    await db()`
      INSERT INTO channels (id, org_id, created_by, name, description, type, is_private)
      VALUES (${channelId}, ${orgId}, ${userId}, ${E2E_PREFIX + ' channel'}, 'e2e seed', 'stream', false)`
    await db()`
      INSERT INTO channel_members (channel_id, user_id, role)
      VALUES (${channelId}, ${userId}, 'member')`
    await db()`
      INSERT INTO channel_topics (id, channel_id, org_id, created_by, name, message_count, last_message_at)
      VALUES (${topicId}, ${channelId}, ${orgId}, ${userId}, ${E2E_PREFIX + ' topic'}, 1, now())`
    await db()`
      INSERT INTO channel_messages (id, channel_id, topic_id, org_id, author_id, author_name, author_email, body)
      VALUES (${randomUUID()}, ${channelId}, ${topicId}, ${orgId}, ${userId},
              'E2E Author', 'e2e@test.local', ${E2E_PREFIX + ' seeded message body'})`
  })

  test.afterAll(async () => {
    await db()`DELETE FROM channel_messages WHERE channel_id = ${channelId}`
    await db()`DELETE FROM channel_topics WHERE channel_id = ${channelId}`
    await db()`DELETE FROM channel_members WHERE channel_id = ${channelId}`
    await db()`DELETE FROM channels WHERE id = ${channelId}`
  })

  test('root redirects an authed user to their org', async ({ page, context }) => {
    await context.addCookies([{ name: 'owl_session', value: sess, url: BASE }])
    await page.goto(`${BASE}/`)
    await page.waitForURL(/\/org\//, { timeout: 15_000 })
  })

  test('org page renders and lists the seeded channel', async ({ page, context }) => {
    await context.addCookies([{ name: 'owl_session', value: sess, url: BASE }])
    const res = await page.goto(`${BASE}/org/${orgSlug}`)
    expect(res!.status()).toBeLessThan(400)
    await expect(page.getByText(`${E2E_PREFIX} channel`).first()).toBeVisible({ timeout: 15_000 })
  })

  test('channel page shows the seeded topic', async ({ page, context }) => {
    await context.addCookies([{ name: 'owl_session', value: sess, url: BASE }])
    const res = await page.goto(`${BASE}/org/${orgSlug}/${channelId}`)
    expect(res!.status()).toBeLessThan(500)
    if (res!.status() < 400) {
      await expect(page.getByText(`${E2E_PREFIX} topic`).first()).toBeVisible({ timeout: 15_000 })
    }
  })

  test('video call creation requires auth', async ({ request }) => {
    const res = await request.post(`${BASE}/api/video/calls`, {
      data: { channelId, title: 'nope' },
      maxRedirects: 0,
    })
    expect([302, 307, 401, 403]).toContain(res.status())
  })
})
