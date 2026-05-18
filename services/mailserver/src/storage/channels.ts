import { sql, newId } from '../db.js'

export interface Channel {
  id: string
  accountId: string
  name: string
  description: string | null
  isPrivate: boolean
  createdBy: string | null
  createdAt: Date
}

export interface ChannelMessage {
  id: string
  channelId: string
  accountId: string
  senderName: string
  senderEmail: string
  body: string
  editedAt: Date | null
  createdAt: Date
}

export async function ensureDefaultChannels(accountId: string): Promise<void> {
  await sql`
    INSERT INTO channels (id, account_id, name, description, created_by)
    VALUES (${newId()}, ${accountId}, 'general', 'General discussion', 'system')
    ON CONFLICT (account_id, name) DO NOTHING`
}

export async function listChannels(accountId: string): Promise<Channel[]> {
  await ensureDefaultChannels(accountId)
  return sql<Channel[]>`
    SELECT id, account_id, name, description, is_private, created_by, created_at
    FROM channels WHERE account_id = ${accountId}
    ORDER BY name ASC`
}

export async function getChannel(accountId: string, id: string): Promise<Channel | null> {
  const [row] = await sql<Channel[]>`
    SELECT id, account_id, name, description, is_private, created_by, created_at
    FROM channels WHERE id = ${id} AND account_id = ${accountId}`
  return row ?? null
}

export async function createChannel(
  accountId: string,
  input: { name: string; description?: string; isPrivate?: boolean; createdBy?: string },
): Promise<Channel> {
  const name = input.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (!name) throw new Error('Invalid channel name')
  const [row] = await sql<Channel[]>`
    INSERT INTO channels (id, account_id, name, description, is_private, created_by)
    VALUES (${newId()}, ${accountId}, ${name}, ${input.description ?? null},
            ${input.isPrivate ?? false}, ${input.createdBy ?? null})
    RETURNING id, account_id, name, description, is_private, created_by, created_at`
  return row
}

export async function deleteChannel(accountId: string, id: string): Promise<boolean> {
  const result = await sql`DELETE FROM channels WHERE id = ${id} AND account_id = ${accountId} AND name != 'general'`
  return result.count > 0
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function listMessages(
  channelId: string,
  accountId: string,
  opts: { limit?: number; before?: string; after?: string } = {},
): Promise<ChannelMessage[]> {
  const { limit = 50 } = opts

  if (opts.after) {
    // Fetch messages newer than `after` (for polling)
    const [ref] = await sql<{ created_at: Date }[]>`
      SELECT created_at FROM channel_messages WHERE id = ${opts.after} AND channel_id = ${channelId}`
    if (!ref) return []
    return sql<ChannelMessage[]>`
      SELECT id, channel_id, account_id, sender_name, sender_email, body, edited_at, created_at
      FROM channel_messages
      WHERE channel_id = ${channelId} AND account_id = ${accountId}
        AND created_at > ${ref.created_at}
      ORDER BY created_at ASC
      LIMIT ${limit}`
  }

  if (opts.before) {
    // Fetch older messages for infinite scroll
    const [ref] = await sql<{ created_at: Date }[]>`
      SELECT created_at FROM channel_messages WHERE id = ${opts.before} AND channel_id = ${channelId}`
    if (!ref) return []
    return sql<ChannelMessage[]>`
      SELECT id, channel_id, account_id, sender_name, sender_email, body, edited_at, created_at
      FROM channel_messages
      WHERE channel_id = ${channelId} AND account_id = ${accountId}
        AND created_at < ${ref.created_at}
      ORDER BY created_at DESC
      LIMIT ${limit}`
  }

  // Initial load — most recent N messages, returned oldest-first
  const rows = await sql<ChannelMessage[]>`
    SELECT id, channel_id, account_id, sender_name, sender_email, body, edited_at, created_at
    FROM channel_messages
    WHERE channel_id = ${channelId} AND account_id = ${accountId}
    ORDER BY created_at DESC
    LIMIT ${limit}`
  return rows.reverse()
}

export async function postMessage(
  channelId: string,
  accountId: string,
  input: { senderName: string; senderEmail: string; body: string },
): Promise<ChannelMessage> {
  const [row] = await sql<ChannelMessage[]>`
    INSERT INTO channel_messages (id, channel_id, account_id, sender_name, sender_email, body)
    VALUES (${newId()}, ${channelId}, ${accountId}, ${input.senderName}, ${input.senderEmail}, ${input.body})
    RETURNING id, channel_id, account_id, sender_name, sender_email, body, edited_at, created_at`
  return row
}

export async function deleteMessage(
  channelId: string,
  accountId: string,
  messageId: string,
): Promise<boolean> {
  const result = await sql`
    DELETE FROM channel_messages
    WHERE id = ${messageId} AND channel_id = ${channelId} AND account_id = ${accountId}`
  return result.count > 0
}
