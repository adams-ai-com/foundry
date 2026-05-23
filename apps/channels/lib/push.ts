import webpush from 'web-push'
import db from '@/lib/db'

let configured = false

function ensureConfigured() {
  if (configured) return
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const mailto = process.env.VAPID_MAILTO ?? 'mailto:admin@foundry.local'
  if (!pub || !priv) return
  webpush.setVapidDetails(mailto, pub, priv)
  configured = true
}

export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? ''
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<void> {
  ensureConfigured()
  if (!configured) return

  const subs = await db`
    SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}
  ` as { endpoint: string; p256dh: string; auth: string }[]

  const json = JSON.stringify(payload)
  const dead: string[] = []

  await Promise.allSettled(
    subs.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          json,
        )
      } catch (err: unknown) {
        // 410 Gone = subscription expired; remove it
        if (err && typeof err === 'object' && 'statusCode' in err &&
            (err.statusCode === 410 || err.statusCode === 404)) {
          dead.push(sub.endpoint)
        }
      }
    }),
  )

  if (dead.length) {
    await db`DELETE FROM push_subscriptions WHERE user_id = ${userId} AND endpoint = ANY(${dead})`
  }
}

// Notify users mentioned in a message body (@handle or display name match)
export async function notifyMentions(params: {
  orgId: string
  senderName: string
  channelName: string
  topicName: string
  body: string
  url: string
}): Promise<void> {
  const { orgId, senderName, channelName, topicName, body, url } = params
  // Find @mentions in body — @word or @"display name"
  const mentionPatterns = [...body.matchAll(/@([a-zA-Z0-9._-]+)/g)].map(m => m[1].toLowerCase())
  if (!mentionPatterns.length) return

  // Look up users whose display_name or email starts with a mention token
  // We use a simple approach: fetch all org members and match client-side
  // (org sizes are small; no FTS needed for mentions)
  const members = await db`
    SELECT id, display_name, email FROM org_members
    WHERE org_id = ${orgId}
  ` as { id: string; display_name: string; email: string }[]

  const toNotify = members.filter(m => {
    const name = (m.display_name ?? '').toLowerCase()
    const emailUser = (m.email ?? '').split('@')[0].toLowerCase()
    return mentionPatterns.some(p => name.startsWith(p) || emailUser.startsWith(p))
  })

  await Promise.allSettled(
    toNotify.map(m => sendPushToUser(m.id, {
      title: `${senderName} mentioned you in #${channelName}`,
      body: `${topicName}: ${body.slice(0, 100)}`,
      url,
      tag: `mention-${m.id}`,
    }))
  )
}
