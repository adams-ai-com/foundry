import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import db from '@/lib/db'

export type GChatSpace = {
  id: string           // e.g. "spaces/AAAA" or folder path used as key
  name: string
  type: 'SPACE' | 'GROUP_DIRECT_MESSAGE' | 'DIRECT_MESSAGE' | 'unknown'
  infoFile: string     // path inside ZIP to group_info / space_info JSON
  messagesFile: string // path inside ZIP to messages.json
}

export type GChatUser = {
  email: string
  name: string
}

export type ParsedGChatZip = {
  spaces: GChatSpace[]
  users: GChatUser[]
}

type RawGroupInfo = {
  name?: string
  id?: string
  type?: string
}

type RawMessage = {
  message_id?: string
  topic_id?: string
  creator?: {
    name?: string
    email?: string
    user_type?: string
  }
  created_date?: string
  text?: string
  attached_files?: Array<{ export_name?: string; original_name?: string }>
  annotations?: unknown[]
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

// "Friday, May 23, 2025 at 2:30:00 PM UTC" → ISO string
function parseGChatDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString()
  try {
    // Strip day-of-week prefix, replace " at " with " "
    const cleaned = dateStr.replace(/^[A-Za-z]+,\s*/, '').replace(' at ', ' ')
    const d = new Date(cleaned)
    if (!isNaN(d.getTime())) return d.toISOString()
  } catch { /* fall through */ }
  return new Date().toISOString()
}

export function parseGoogleChatZip(zipPath: string): ParsedGChatZip {
  const entries = listZipEntries(zipPath)

  // Find all group_info.json or space_info.json files
  const infoFiles = entries.filter(e =>
    e.endsWith('group_info.json') || e.endsWith('space_info.json')
  )

  const spaces: GChatSpace[] = []
  const usersMap = new Map<string, GChatUser>()

  for (const infoPath of infoFiles) {
    const raw = readFileFromZip(zipPath, infoPath)
    if (!raw) continue

    let info: RawGroupInfo = {}
    try { info = JSON.parse(raw) as RawGroupInfo } catch { /* ignore */ }

    // Derive messages.json path from the same directory
    const dir = infoPath.replace(/[^/]*$/, '')
    const messagesPath = dir + 'messages.json'
    if (!entries.includes(messagesPath)) continue

    const spaceType = (() => {
      const t = (info.type ?? '').toUpperCase()
      if (t === 'SPACE') return 'SPACE'
      if (t === 'GROUP_DIRECT_MESSAGE') return 'GROUP_DIRECT_MESSAGE'
      if (t === 'DIRECT_MESSAGE') return 'DIRECT_MESSAGE'
      return 'unknown' as const
    })()

    // Name: prefer info.name, fall back to folder name
    const folderName = dir.replace(/.*\/([^/]+)\/$/, '$1').replace(/\/$/, '')
    const name = info.name?.trim() || folderName || 'Unnamed Space'

    spaces.push({
      id: info.id ?? dir,
      name,
      type: spaceType,
      infoFile: infoPath,
      messagesFile: messagesPath,
    })

    // Sample users from messages
    const msgRaw = readFileFromZip(zipPath, messagesPath)
    if (!msgRaw) continue
    try {
      const parsed = JSON.parse(msgRaw) as { messages?: RawMessage[] }
      for (const msg of parsed.messages ?? []) {
        const email = msg.creator?.email
        const name = msg.creator?.name
        if (email && name && !usersMap.has(email)) {
          usersMap.set(email, { email, name })
        }
      }
    } catch { /* ignore */ }
  }

  return { spaces, users: Array.from(usersMap.values()) }
}

type UserMapping = Record<string, string>  // email → foundryAuthorId
type SpaceMapping = Record<string, {
  space_name: string
  space_type: string
  foundry_channel_id: string | null
  create_new: boolean
  new_name: string | null
  skip: boolean
}>

export async function runGoogleChatImport(jobId: string, orgId: string, createdBy: string): Promise<void> {
  const jobs = await db`
    SELECT * FROM google_chat_import_jobs WHERE id = ${jobId} AND org_id = ${orgId}
  ` as unknown as Record<string, unknown>[]
  if (!jobs.length) throw new Error('Job not found')

  const job = jobs[0] as {
    zip_path: string
    user_mapping: UserMapping
    space_mapping: SpaceMapping
    gchat_spaces: GChatSpace[]
    include_bots: boolean
  }

  if (!existsSync(job.zip_path)) throw new Error(`ZIP not found: ${job.zip_path}`)

  let totalImported = 0
  let usersUnmatched = 0
  let attachmentsUnavailable = 0

  for (const space of job.gchat_spaces) {
    const mapping = job.space_mapping[space.id]
    if (!mapping || mapping.skip) continue

    // Resolve or create OWL channel
    let foundryChannelId: string
    if (mapping.foundry_channel_id) {
      foundryChannelId = mapping.foundry_channel_id
    } else if (mapping.create_new) {
      const rawName = mapping.new_name || space.name
      const slug = rawName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'imported'
      const [ch] = await db`
        INSERT INTO channels (org_id, name, description, created_by, type)
        VALUES (${orgId}, ${slug}, ${`Imported from Google Chat: ${rawName}`}, ${createdBy}, 'stream')
        ON CONFLICT (org_id, name) DO UPDATE SET description = EXCLUDED.description
        RETURNING id
      ` as { id: string }[]
      foundryChannelId = ch.id
    } else { continue }

    // Read messages
    const msgRaw = readFileFromZip(job.zip_path, space.messagesFile)
    if (!msgRaw) continue

    let messages: RawMessage[]
    try {
      const parsed = JSON.parse(msgRaw) as { messages?: RawMessage[] }
      messages = parsed.messages ?? []
    } catch { continue }

    // Filter bots unless opted in
    if (!job.include_bots) {
      messages = messages.filter(m => m.creator?.user_type !== 'Bot')
    }
    // Filter empty messages
    messages = messages.filter(m => m.text?.trim() || m.attached_files?.length)

    // Sort chronologically
    messages.sort((a, b) =>
      new Date(parseGChatDate(a.created_date ?? '')).getTime() -
      new Date(parseGChatDate(b.created_date ?? '')).getTime()
    )

    // Build topic map: topic_id → foundry topic id
    // In Google Chat, the root message has message_id === topic_id (or no topic_id in flat spaces)
    const gchatTopicToOwl = new Map<string, string>()
    const gchatMsgToOwl = new Map<string, string>()

    // Pass 1: create topics for root messages
    // Root = message_id === topic_id, or topic_id missing (flat space)
    const isFlat = messages.every(m => !m.topic_id || m.topic_id === m.message_id)

    if (isFlat) {
      // Flat space → one topic for the whole channel (named after the space)
      const [t] = await db`
        INSERT INTO channel_topics (channel_id, org_id, name, created_by)
        VALUES (${foundryChannelId}, ${orgId}, ${space.name}, ${createdBy})
        ON CONFLICT DO NOTHING
        RETURNING id
      ` as { id: string }[]
      const topicId = t?.id ?? (await db`
        SELECT id FROM channel_topics WHERE channel_id = ${foundryChannelId} AND org_id = ${orgId} AND name = ${space.name} LIMIT 1
      ` as { id: string }[])[0]?.id
      if (topicId) {
        for (const m of messages) {
          if (m.message_id) gchatTopicToOwl.set(m.message_id, topicId)
        }
      }
    } else {
      // Threaded space → one topic per thread root
      const rootMessages = messages.filter(m => m.message_id && m.message_id === m.topic_id)
      for (const msg of rootMessages) {
        const body = msg.text?.trim() ?? ''
        const topicName = body.slice(0, 60).replace(/\n/g, ' ') || `Thread ${(msg.message_id ?? '').slice(-8)}`
        const [t] = await db`
          INSERT INTO channel_topics (channel_id, org_id, name, created_by)
          VALUES (${foundryChannelId}, ${orgId}, ${topicName}, ${createdBy})
          ON CONFLICT DO NOTHING
          RETURNING id
        ` as { id: string }[]
        const topicId = t?.id ?? (await db`
          SELECT id FROM channel_topics WHERE channel_id = ${foundryChannelId} AND org_id = ${orgId} AND name = ${topicName} LIMIT 1
        ` as { id: string }[])[0]?.id
        if (topicId && msg.message_id) gchatTopicToOwl.set(msg.message_id, topicId)
      }
    }

    // Pass 2: insert all messages
    for (const msg of messages) {
      const topicKey = isFlat
        ? (messages[0]?.message_id ?? '')
        : (msg.topic_id ?? msg.message_id ?? '')
      const topicId = gchatTopicToOwl.get(topicKey)
      if (!topicId) continue

      const email = msg.creator?.email ?? ''
      let authorId = createdBy
      let authorName = msg.creator?.name ?? 'Unknown'
      const authorEmail = email || `unknown@gchat.import`

      if (email && job.user_mapping[email]) {
        authorId = job.user_mapping[email]
      } else if (email) {
        usersUnmatched++
      }

      let body = msg.text?.trim() ?? ''
      for (const f of msg.attached_files ?? []) {
        const fname = f.original_name ?? f.export_name ?? 'file'
        body += `\n\n📎 ${fname}`
        attachmentsUnavailable++
      }
      if (!body.trim()) continue

      const parentId = (!isFlat && msg.topic_id && msg.topic_id !== msg.message_id)
        ? (gchatMsgToOwl.get(msg.topic_id) ?? null)
        : null

      const msgKey = msg.message_id ?? ''
      const createdAt = parseGChatDate(msg.created_date ?? '')

      try {
        const [inserted] = await db`
          INSERT INTO channel_messages
            (channel_id, topic_id, org_id, author_id, author_name, author_email,
             body, parent_message_id, slack_ts, protocol, created_at)
          VALUES
            (${foundryChannelId}, ${topicId}, ${orgId}, ${authorId}, ${authorName}, ${authorEmail},
             ${body.trim()}, ${parentId}, ${msgKey}, 'imported', ${createdAt})
          ON CONFLICT ON CONSTRAINT idx_messages_slack_ts DO NOTHING
          RETURNING id
        ` as { id: string }[]
        if (inserted) {
          gchatMsgToOwl.set(msgKey, inserted.id)
          totalImported++
        }
      } catch (err) { console.error(`[gchat-import] insert ${msgKey}:`, err) }
    }

    // Update topic stats
    await db`
      UPDATE channel_topics ct SET
        message_count = (SELECT COUNT(*) FROM channel_messages cm WHERE cm.topic_id = ct.id AND cm.deleted_at IS NULL),
        last_message_at = (SELECT MAX(cm.created_at) FROM channel_messages cm WHERE cm.topic_id = ct.id AND cm.deleted_at IS NULL)
      WHERE ct.channel_id = ${foundryChannelId} AND ct.org_id = ${orgId}
    `
    await db`
      UPDATE google_chat_import_jobs
      SET messages_imported = ${totalImported}, users_unmatched = ${usersUnmatched},
          attachments_unavailable = ${attachmentsUnavailable}
      WHERE id = ${jobId}
    `
  }

  await db`
    UPDATE google_chat_import_jobs
    SET status = 'complete', completed_at = now(),
        messages_imported = ${totalImported}, users_unmatched = ${usersUnmatched},
        attachments_unavailable = ${attachmentsUnavailable}
    WHERE id = ${jobId}
  `
}
