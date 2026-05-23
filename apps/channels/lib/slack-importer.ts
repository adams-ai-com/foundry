import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import db from '@/lib/db'

export type SlackUser = {
  id: string
  name: string
  real_name: string | null
  email: string | null
  is_bot: boolean
}

export type SlackChannel = {
  id: string
  name: string
  is_private: boolean
  is_dm: boolean
  purpose: string | null
}

export type ParsedSlackZip = {
  workspace_name: string
  users: SlackUser[]
  channels: SlackChannel[]
}

function readFileFromZip(zipPath: string, filename: string): string | null {
  try {
    return execSync(`unzip -p "${zipPath}" "${filename}"`, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'ignore'],
    }) || null
  } catch { return null }
}

export function parseSlackZip(zipPath: string): ParsedSlackZip {
  const usersRaw = readFileFromZip(zipPath, 'users.json')
  const channelsRaw = readFileFromZip(zipPath, 'channels.json')
  if (!usersRaw) throw new Error('Invalid Slack export: missing users.json')
  if (!channelsRaw) throw new Error('Invalid Slack export: missing channels.json')

  type RawUser = { id: string; name: string; real_name?: string; profile?: { email?: string; display_name?: string }; is_bot?: boolean; deleted?: boolean }
  const users: SlackUser[] = (JSON.parse(usersRaw) as RawUser[])
    .filter(u => !u.deleted)
    .map(u => ({
      id: u.id,
      name: u.profile?.display_name || u.real_name || u.name,
      real_name: u.real_name ?? null,
      email: u.profile?.email ?? null,
      is_bot: u.is_bot ?? false,
    }))

  type RawChannel = { id: string; name: string; is_private?: boolean; is_archived?: boolean; purpose?: { value?: string } }
  const channels: SlackChannel[] = (JSON.parse(channelsRaw) as RawChannel[])
    .map(c => ({
      id: c.id,
      name: c.name,
      is_private: c.is_private ?? false,
      is_dm: false,
      purpose: c.purpose?.value || null,
    }))

  const dmsRaw = readFileFromZip(zipPath, 'dms.json')
  if (dmsRaw) {
    try {
      type RawDm = { id: string; members?: string[] }
      ;(JSON.parse(dmsRaw) as RawDm[]).forEach((dm, i) => {
        channels.push({ id: dm.id, name: `DM-${i + 1}`, is_private: true, is_dm: true, purpose: null })
      })
    } catch { /* ignore malformed dms.json */ }
  }

  return { workspace_name: 'Slack Workspace', users, channels }
}

type SlackMessage = {
  ts: string
  user?: string
  bot_id?: string
  subtype?: string
  text?: string
  thread_ts?: string
  reactions?: Array<{ name: string; users: string[] }>
  files?: Array<{ name?: string }>
}

type UserMapping = Record<string, string>
type ChanMapping = Record<string, { foundry_channel_id: string | null; create_new: boolean; new_name: string | null; skip: boolean }>

export async function runSlackImport(jobId: string, orgId: string, createdBy: string): Promise<void> {
  const jobs = await db`SELECT * FROM slack_import_jobs WHERE id = ${jobId} AND org_id = ${orgId}` as unknown as Record<string, unknown>[]
  if (!jobs.length) throw new Error('Job not found')
  const job = jobs[0] as {
    zip_path: string
    user_mapping: UserMapping
    channel_mapping: ChanMapping
    slack_users: SlackUser[]
    slack_channels: SlackChannel[]
    include_dms: boolean
    include_bots: boolean
  }

  if (!existsSync(job.zip_path)) throw new Error(`ZIP not found: ${job.zip_path}`)

  const slackUsers = new Map<string, SlackUser>(job.slack_users.map(u => [u.id, u]))

  // Build zip file index: channel dir → sorted daily files
  const listing = execSync(`unzip -l "${job.zip_path}"`, { encoding: 'utf8' })
  const zipFiles = listing.split('\n')
    .map(l => l.trim().split(/\s+/).at(-1) ?? '')
    .filter(f => f.endsWith('.json') && f.includes('/') && !f.startsWith('__'))
  const channelDirs = new Map<string, string[]>()
  for (const f of zipFiles) {
    const dir = f.split('/')[0]
    if (!channelDirs.has(dir)) channelDirs.set(dir, [])
    channelDirs.get(dir)!.push(f)
  }

  let totalImported = 0
  let usersUnmatched = 0
  let attachmentsUnavailable = 0

  for (const slack_channel of job.slack_channels) {
    const mapping = job.channel_mapping[slack_channel.id]
    if (!mapping || mapping.skip) continue
    if (slack_channel.is_dm && !job.include_dms) continue

    // Resolve or create Foundry channel
    let foundryChannelId: string
    if (mapping.foundry_channel_id) {
      foundryChannelId = mapping.foundry_channel_id
    } else if (mapping.create_new) {
      const rawName = mapping.new_name || slack_channel.name
      const slug = rawName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'imported'
      const [ch] = await db`
        INSERT INTO channels (org_id, name, description, created_by, type)
        VALUES (${orgId}, ${slug}, ${slack_channel.purpose ?? `Imported from Slack #${rawName}`},
                ${createdBy}, ${slack_channel.is_dm ? 'dm' : 'stream'})
        ON CONFLICT (org_id, name) DO UPDATE SET description = EXCLUDED.description
        RETURNING id
      ` as { id: string }[]
      foundryChannelId = ch.id
    } else { continue }

    // Get or create the import topic
    const topicName = `Imported from Slack #${slack_channel.name}`
    let topicId: string
    const existing = await db`
      SELECT id FROM channel_topics WHERE channel_id = ${foundryChannelId} AND org_id = ${orgId} AND name = ${topicName}
    ` as { id: string }[]
    if (existing.length) {
      topicId = existing[0].id
    } else {
      const [t] = await db`
        INSERT INTO channel_topics (channel_id, org_id, name, created_by)
        VALUES (${foundryChannelId}, ${orgId}, ${topicName}, ${createdBy})
        RETURNING id
      ` as { id: string }[]
      topicId = t.id
    }

    const tsToMsgId = new Map<string, string>()
    const files = (channelDirs.get(slack_channel.name) ?? []).sort()

    for (const file of files) {
      const raw = readFileFromZip(job.zip_path, file)
      if (!raw) continue
      let messages: SlackMessage[]
      try { messages = JSON.parse(raw) as SlackMessage[] } catch { continue }
      messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts))

      for (const msg of messages) {
        if (msg.subtype && !['bot_message', 'thread_broadcast'].includes(msg.subtype)) continue
        if ((msg.subtype === 'bot_message' || msg.bot_id) && !job.include_bots) continue

        const slackUser = slackUsers.get(msg.user ?? '')
        let authorId = createdBy
        let authorName = slackUser?.name ?? (msg.bot_id ? 'Bot' : 'Unknown')
        let authorEmail = slackUser?.email ?? `${msg.user ?? 'unknown'}@slack.import`

        if (msg.user && job.user_mapping[msg.user]) {
          authorId = job.user_mapping[msg.user]
        } else {
          usersUnmatched++
        }

        let body = (msg.text ?? '').trim()
        body = body.replace(/<@([A-Z0-9]+)>/g, (_, uid) => `@${slackUsers.get(uid)?.name ?? 'user'}`)
        body = body.replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
        body = body.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '[$2]($1)')
        body = body.replace(/<(https?:\/\/[^>]+)>/g, '$1')

        for (const _f of (msg.files ?? [])) { attachmentsUnavailable++; body += '\n\n📎 [Attachment unavailable]' }
        if (!body.trim()) continue

        const parentMessageId = (msg.thread_ts && msg.thread_ts !== msg.ts)
          ? (tsToMsgId.get(msg.thread_ts) ?? null)
          : null
        const createdAt = new Date(parseFloat(msg.ts) * 1000).toISOString()
        const reactions = JSON.stringify((msg.reactions ?? []).map(r => ({
          emoji: `:${r.name}:`,
          user_ids: r.users.map(uid => job.user_mapping[uid] ?? uid),
        })))

        try {
          const [inserted] = await db`
            INSERT INTO channel_messages
              (channel_id, topic_id, org_id, author_id, author_name, author_email,
               body, reactions, parent_message_id, slack_ts, protocol, created_at)
            VALUES
              (${foundryChannelId}, ${topicId}, ${orgId}, ${authorId}, ${authorName}, ${authorEmail},
               ${body.trim()}, ${reactions}::jsonb, ${parentMessageId}, ${msg.ts}, 'imported', ${createdAt})
            ON CONFLICT ON CONSTRAINT idx_messages_slack_ts DO NOTHING
            RETURNING id
          ` as { id: string }[]
          if (inserted) { tsToMsgId.set(msg.ts, inserted.id); totalImported++ }
        } catch (err) { console.error(`[slack-import] insert ${msg.ts}:`, err) }
      }
    }

    await db`
      UPDATE channel_topics SET
        message_count = (SELECT COUNT(*) FROM channel_messages WHERE topic_id = ${topicId} AND deleted_at IS NULL),
        last_message_at = (SELECT MAX(created_at) FROM channel_messages WHERE topic_id = ${topicId} AND deleted_at IS NULL)
      WHERE id = ${topicId}
    `
    await db`
      UPDATE slack_import_jobs SET messages_imported = ${totalImported},
        users_unmatched = ${usersUnmatched}, attachments_unavailable = ${attachmentsUnavailable}
      WHERE id = ${jobId}
    `
  }

  await db`
    UPDATE slack_import_jobs SET status = 'complete', completed_at = now(),
      messages_imported = ${totalImported}, users_unmatched = ${usersUnmatched},
      attachments_unavailable = ${attachmentsUnavailable}
    WHERE id = ${jobId}
  `
}
