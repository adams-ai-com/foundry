import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import db from '@/lib/db'

export type TeamsUser = {
  id: string        // AAD object ID
  displayName: string
  email: string | null
}

export type TeamsChannel = {
  teamId: string
  teamName: string
  channelId: string
  channelName: string
}

export type ParsedTeamsZip = {
  users: TeamsUser[]
  channels: TeamsChannel[]
}

type RawManifest = {
  Teams?: Array<{
    id: string
    displayName: string
    Channels?: Array<{ id: string; displayName: string }>
  }>
}

type RawMessage = {
  id: string
  replyToId?: string | null
  createdDateTime: string
  lastModifiedDateTime?: string
  deletedDateTime?: string | null
  messageType?: string
  from?: {
    user?: {
      id?: string
      displayName?: string
      userIdentityType?: string
    }
  }
  body?: { contentType?: string; content?: string }
  subject?: string | null
  attachments?: Array<{ id?: string; contentType?: string; name?: string; contentUrl?: string }>
  reactions?: Array<{
    reactionType: string
    user?: { user?: { id?: string; displayName?: string } }
  }>
  mentions?: Array<{ id?: number; mentionText?: string; mentioned?: { user?: { id?: string; displayName?: string } } }>
}

function readFileFromZip(zipPath: string, filename: string): string | null {
  try {
    return execSync(`unzip -p "${zipPath}" "${filename}"`, {
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'ignore'],
    }) || null
  } catch { return null }
}

function listZipEntries(zipPath: string): string[] {
  try {
    return execSync(`unzip -l "${zipPath}"`, { encoding: 'utf8' })
      .split('\n')
      .map(l => l.trim().split(/\s+/).at(-1) ?? '')
      .filter(f => f.length > 0 && !f.startsWith('Name') && !f.startsWith('---') && !f.endsWith('/'))
  } catch { return [] }
}

// Minimal HTML → Markdown for Teams message bodies
function htmlToMarkdown(html: string): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/ul>|<\/ol>/gi, '\n')
    .replace(/<ul[^>]*>|<ol[^>]*>/gi, '')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '_$1_')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '_$1_')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '```\n$1\n```')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<at[^>]*>([\s\S]*?)<\/at>/gi, '$1')
    .replace(/<attachment[^>]*\/?>(?:<\/attachment>)?/gi, '')
    .replace(/<img[^>]*alt="([^"]*)"[^>]*\/?>/gi, '$1')
    .replace(/<img[^>]*\/?>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function parseTeamsZip(zipPath: string): ParsedTeamsZip {
  const entries = listZipEntries(zipPath)
  const jsonEntries = entries.filter(e => e.endsWith('.json'))

  // Try manifest.json first — gives us team/channel structure with names
  const manifestRaw = readFileFromZip(zipPath, 'manifest.json')
  const channels: TeamsChannel[] = []
  const teamNames = new Map<string, string>()
  const channelNames = new Map<string, string>()

  if (manifestRaw) {
    try {
      const manifest = JSON.parse(manifestRaw) as RawManifest
      for (const team of manifest.Teams ?? []) {
        teamNames.set(team.id, team.displayName)
        for (const ch of team.Channels ?? []) {
          channelNames.set(ch.id, ch.displayName)
          channels.push({
            teamId: team.id,
            teamName: team.displayName,
            channelId: ch.id,
            channelName: ch.displayName,
          })
        }
      }
    } catch { /* ignore */ }
  }

  // If no manifest or no channels found, discover from ZIP path structure
  // Expected pattern: <teamId>/<channelId>/messages.json
  if (channels.length === 0) {
    const msgFiles = jsonEntries.filter(e => e.endsWith('messages.json') || e.includes('/messages'))
    for (const f of msgFiles) {
      const parts = f.split('/')
      if (parts.length >= 2) {
        const teamId = parts[0]
        const channelId = parts[1]
        if (!channels.find(c => c.channelId === channelId)) {
          channels.push({
            teamId,
            teamName: teamNames.get(teamId) ?? teamId,
            channelId,
            channelName: channelNames.get(channelId) ?? channelId,
          })
        }
      }
    }
  }

  // Collect users by scanning message files (sample first channel for users)
  const usersMap = new Map<string, TeamsUser>()
  const sampleFiles = jsonEntries.filter(e => e.endsWith('.json') && e !== 'manifest.json').slice(0, 3)
  for (const f of sampleFiles) {
    const raw = readFileFromZip(zipPath, f)
    if (!raw) continue
    try {
      const messages = JSON.parse(raw) as RawMessage[]
      for (const msg of Array.isArray(messages) ? messages : []) {
        const u = msg.from?.user
        if (u?.id && u.userIdentityType === 'aadUser' && !usersMap.has(u.id)) {
          usersMap.set(u.id, {
            id: u.id,
            displayName: u.displayName ?? 'Unknown',
            email: null, // Teams export rarely includes email directly; matched by name fallback
          })
        }
        for (const r of msg.reactions ?? []) {
          const ru = r.user?.user
          if (ru?.id && !usersMap.has(ru.id)) {
            usersMap.set(ru.id, { id: ru.id, displayName: ru.displayName ?? 'Unknown', email: null })
          }
        }
      }
    } catch { /* ignore */ }
  }

  return { users: Array.from(usersMap.values()), channels }
}

type UserMapping = Record<string, string>   // aadId → foundryAuthorId
type ChanMapping = Record<string, {
  team_name: string; channel_name: string
  foundry_channel_id: string | null; create_new: boolean
  new_name: string | null; skip: boolean
}>

export async function runTeamsImport(jobId: string, orgId: string, createdBy: string): Promise<void> {
  const jobs = await db`SELECT * FROM teams_import_jobs WHERE id = ${jobId} AND org_id = ${orgId}` as unknown as Record<string, unknown>[]
  if (!jobs.length) throw new Error('Job not found')
  const job = jobs[0] as {
    zip_path: string
    user_mapping: UserMapping
    channel_mapping: ChanMapping
    teams_channels: TeamsChannel[]
    include_system_events: boolean
  }

  if (!existsSync(job.zip_path)) throw new Error(`ZIP not found: ${job.zip_path}`)

  const entries = listZipEntries(job.zip_path)

  let totalImported = 0
  let usersUnmatched = 0
  let attachmentsUnavailable = 0

  for (const teamsChannel of job.teams_channels) {
    const mapping = job.channel_mapping[teamsChannel.channelId]
    if (!mapping || mapping.skip) continue

    // Resolve or create OWL channel
    let foundryChannelId: string
    if (mapping.foundry_channel_id) {
      foundryChannelId = mapping.foundry_channel_id
    } else if (mapping.create_new) {
      const rawName = mapping.new_name || teamsChannel.channelName
      const slug = rawName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'imported'
      const [ch] = await db`
        INSERT INTO channels (org_id, name, description, created_by, type)
        VALUES (${orgId}, ${slug},
                ${`Imported from Teams: ${teamsChannel.teamName} / ${rawName}`},
                ${createdBy}, 'stream')
        ON CONFLICT (org_id, name) DO UPDATE SET description = EXCLUDED.description
        RETURNING id
      ` as { id: string }[]
      foundryChannelId = ch.id
    } else { continue }

    // Find messages.json for this channel
    const msgFile = entries.find(e =>
      e.includes(teamsChannel.channelId) && (e.endsWith('messages.json') || e.endsWith('.json'))
    ) ?? `${teamsChannel.teamId}/${teamsChannel.channelId}/messages.json`

    const raw = readFileFromZip(job.zip_path, msgFile)
    if (!raw) continue

    let messages: RawMessage[]
    try {
      const parsed = JSON.parse(raw)
      messages = Array.isArray(parsed) ? parsed : (parsed?.value ?? [])
    } catch { continue }

    // Filter out deleted + system events (unless include_system_events)
    messages = messages.filter(m => {
      if (m.deletedDateTime) return false
      if (m.messageType === 'systemEventMessage' && !job.include_system_events) return false
      return true
    })

    // Sort chronologically
    messages.sort((a, b) => new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime())

    // Pass 1: create topics for root messages (replyToId is null/undefined/"")
    const rootMessages = messages.filter(m => !m.replyToId)
    const msgIdToTopic = new Map<string, string>()  // teamsMessageId → foundryTopicId
    const msgIdToOwlId = new Map<string, string>()  // teamsMessageId → foundryMessageId

    for (const msg of rootMessages) {
      const body = msg.body?.contentType === 'html'
        ? htmlToMarkdown(msg.body.content ?? '')
        : (msg.body?.content ?? '').trim()

      // Topic name: subject (if set) or first 60 chars of body
      const topicName = (msg.subject?.trim()) || body.slice(0, 60).replace(/\n/g, ' ') || `Thread ${msg.id.slice(-8)}`

      const [t] = await db`
        INSERT INTO channel_topics (channel_id, org_id, name, created_by)
        VALUES (${foundryChannelId}, ${orgId}, ${topicName}, ${createdBy})
        ON CONFLICT DO NOTHING
        RETURNING id
      ` as { id: string }[]

      const topicId = t?.id ?? (await db`
        SELECT id FROM channel_topics WHERE channel_id = ${foundryChannelId} AND org_id = ${orgId} AND name = ${topicName}
        LIMIT 1
      ` as { id: string }[])[0]?.id

      if (!topicId) continue
      msgIdToTopic.set(msg.id, topicId)
    }

    // Pass 2: insert all messages (root + replies)
    for (const msg of messages) {
      const topicId = msgIdToTopic.get(msg.id)
        ?? (msg.replyToId ? msgIdToTopic.get(msg.replyToId) : null)
      if (!topicId) continue  // orphaned reply — skip

      const aadId = msg.from?.user?.id ?? ''
      let authorId = createdBy
      let authorName = msg.from?.user?.displayName ?? 'Unknown'
      let authorEmail = `${aadId}@teams.import`

      if (aadId && job.user_mapping[aadId]) {
        authorId = job.user_mapping[aadId]
      } else if (aadId) {
        usersUnmatched++
      }

      const rawBody = msg.body?.contentType === 'html'
        ? htmlToMarkdown(msg.body.content ?? '')
        : (msg.body?.content ?? '').trim()

      let body = rawBody
      for (const att of msg.attachments ?? []) {
        if (att.name) {
          body += `\n\n📎 [${att.name}](${att.contentUrl ?? ''})`.trimEnd()
          if (!att.contentUrl) attachmentsUnavailable++
        }
      }
      if (!body.trim()) continue

      const parentMsgId = msg.replyToId ? (msgIdToOwlId.get(msg.replyToId) ?? null) : null
      const teamsId = msg.id

      const reactions = JSON.stringify((msg.reactions ?? []).map(r => ({
        emoji: `:${r.reactionType}:`,
        user_ids: [r.user?.user?.id ? (job.user_mapping[r.user.user.id] ?? r.user.user.id) : ''].filter(Boolean),
      })))

      try {
        const [inserted] = await db`
          INSERT INTO channel_messages
            (channel_id, topic_id, org_id, author_id, author_name, author_email,
             body, reactions, parent_message_id, slack_ts, protocol, created_at)
          VALUES
            (${foundryChannelId}, ${topicId}, ${orgId}, ${authorId}, ${authorName}, ${authorEmail},
             ${body.trim()}, ${reactions}::jsonb, ${parentMsgId}, ${teamsId}, 'imported',
             ${new Date(msg.createdDateTime).toISOString()})
          ON CONFLICT ON CONSTRAINT idx_messages_slack_ts DO NOTHING
          RETURNING id
        ` as { id: string }[]
        if (inserted) {
          msgIdToOwlId.set(teamsId, inserted.id)
          if (!msg.replyToId) msgIdToTopic.set(msg.id, topicId)
          totalImported++
        }
      } catch (err) { console.error(`[teams-import] insert ${msg.id}:`, err) }
    }

    // Update topic stats for all topics in this channel
    await db`
      UPDATE channel_topics ct SET
        message_count = (SELECT COUNT(*) FROM channel_messages cm WHERE cm.topic_id = ct.id AND cm.deleted_at IS NULL),
        last_message_at = (SELECT MAX(cm.created_at) FROM channel_messages cm WHERE cm.topic_id = ct.id AND cm.deleted_at IS NULL)
      WHERE ct.channel_id = ${foundryChannelId} AND ct.org_id = ${orgId}
    `
    await db`
      UPDATE teams_import_jobs SET messages_imported = ${totalImported},
        users_unmatched = ${usersUnmatched}, attachments_unavailable = ${attachmentsUnavailable}
      WHERE id = ${jobId}
    `
  }

  await db`
    UPDATE teams_import_jobs SET status = 'complete', completed_at = now(),
      messages_imported = ${totalImported}, users_unmatched = ${usersUnmatched},
      attachments_unavailable = ${attachmentsUnavailable}
    WHERE id = ${jobId}
  `
}
