import { unlinkSync } from 'fs'
import { sql } from '../db.js'

export interface ThreadRow {
  id: string
  accountId: string
  workspaceId: string | null
  subject: string
  participants: { name?: string; email: string }[]
  messageCount: number
  unreadCount: number
  lastMessageAt: Date | null
  snippet: string
  isStarred: boolean
  snoozedUntil: Date | null
}

export interface ThreadDetail extends ThreadRow {
  messages: MessageInThread[]
}

export interface MessageInThread {
  id: string
  messageId: string | null
  fromEmail: string
  fromName: string | null
  toAddrs: { name?: string; email: string }[]
  ccAddrs: { name?: string; email: string }[]
  date: Date
  bodyHtml: string | null
  bodyText: string | null
  isRead: boolean
  isStarred: boolean
  attachments: { id: string; filename: string; contentType: string; size: number }[]
}

export async function listThreads(
  accountId: string,
  mailboxId: string,
  page = 1,
  pageSize = 50,
  sort: 'newest' | 'oldest' | 'unread' = 'newest'
): Promise<{ threads: ThreadRow[]; total: number }> {
  const offset = (page - 1) * pageSize

  const orderClause =
    sort === 'oldest'
      ? sql`t.last_message_at ASC NULLS LAST`
      : sort === 'unread'
      ? sql`(t.unread_count > 0) DESC, t.last_message_at DESC NULLS LAST`
      : sql`t.last_message_at DESC NULLS LAST`

  const [threads, countRows] = await Promise.all([
    sql<any[]>`
      SELECT DISTINCT t.* FROM threads t
      JOIN messages m ON m.thread_id = t.id
      WHERE t.account_id = ${accountId}
        AND m.mailbox_id = ${mailboxId}
        AND (t.snoozed_until IS NULL OR t.snoozed_until <= NOW())
      ORDER BY ${orderClause}
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    sql<{ count: number }[]>`
      SELECT COUNT(DISTINCT t.id)::int AS count FROM threads t
      JOIN messages m ON m.thread_id = t.id
      WHERE t.account_id = ${accountId}
        AND m.mailbox_id = ${mailboxId}
        AND (t.snoozed_until IS NULL OR t.snoozed_until <= NOW())
    `,
  ])

  return {
    threads: threads.map(rowToThread),
    total: countRows[0]?.count ?? 0,
  }
}

export async function getThread(accountId: string, threadId: string): Promise<ThreadDetail | null> {
  const threadRows = await sql<any[]>`
    SELECT * FROM threads WHERE id = ${threadId} AND account_id = ${accountId} LIMIT 1
  `
  if (!threadRows.length) return null

  const messages = await sql<any[]>`
    SELECT m.id, m.message_id, m.from_email, m.from_name, m.to_addrs, m.cc_addrs,
           m.date, m.body_html, m.body_text, m.is_read, m.is_starred
    FROM messages m
    WHERE m.thread_id = ${threadId} AND m.account_id = ${accountId}
    ORDER BY m.date ASC
  `

  const attachments = await sql<{ message_id: string; id: string; filename: string; content_type: string; size: number }[]>`
    SELECT f.message_id, f.id, f.filename, f.content_type, f.size
    FROM files f
    JOIN messages m ON m.id = f.message_id
    WHERE m.thread_id = ${threadId}
  `

  type AttRow = { message_id: string; id: string; filename: string; content_type: string; size: number }
  const attsByMessage = new Map<string, AttRow[]>()
  for (const a of attachments) {
    const list = attsByMessage.get(a.message_id)
    if (list) list.push(a)
    else attsByMessage.set(a.message_id, [a])
  }

  const thread = rowToThread(threadRows[0])

  return {
    ...thread,
    messages: messages.map((m) => ({
      id: m.id,
      messageId: m.message_id,
      fromEmail: m.from_email,
      fromName: m.from_name,
      toAddrs: m.to_addrs,
      ccAddrs: m.cc_addrs,
      date: m.date,
      bodyHtml: m.body_html,
      bodyText: m.body_text,
      isRead: m.is_read,
      isStarred: m.is_starred,
      attachments: (attsByMessage.get(m.id) ?? []).map((a) => ({
        id: a.id, filename: a.filename, contentType: a.content_type, size: a.size,
      })),
    })),
  }
}

export async function searchThreads(accountId: string, rawQuery: string, limit = 50): Promise<ThreadRow[]> {
  const fromMatch = rawQuery.match(/\bfrom:(\S+)/)
  const subjectMatch = rawQuery.match(/\bsubject:(\S+)/)
  const isUnread = /\bis:unread\b/.test(rawQuery)
  const isStarred = /\bis:starred\b/.test(rawQuery)
  const hasAttachment = /\bhas:attachment\b/.test(rawQuery)

  const freeText = rawQuery
    .replace(/\bfrom:\S+/g, '')
    .replace(/\bsubject:\S+/g, '')
    .replace(/\bis:\w+/g, '')
    .replace(/\bhas:\w+/g, '')
    .trim()

  const rows = await sql<any[]>`
    SELECT DISTINCT t.* FROM threads t
    JOIN messages m ON m.thread_id = t.id
    WHERE t.account_id = ${accountId}
      AND (
        ${freeText
          ? sql`(
              m.search_vector @@ plainto_tsquery('english', ${freeText})
              OR t.subject ILIKE ${'%' + freeText + '%'}
              OR m.from_email ILIKE ${'%' + freeText + '%'}
            )`
          : sql`TRUE`
        }
      )
      AND (${fromMatch ? sql`m.from_email ILIKE ${'%' + fromMatch[1] + '%'}` : sql`TRUE`})
      AND (${subjectMatch ? sql`m.subject ILIKE ${'%' + subjectMatch[1] + '%'}` : sql`TRUE`})
      AND (${isUnread ? sql`m.is_read = FALSE` : sql`TRUE`})
      AND (${isStarred ? sql`t.is_starred = TRUE` : sql`TRUE`})
      AND (${hasAttachment ? sql`EXISTS (SELECT 1 FROM files f WHERE f.message_id = m.id)` : sql`TRUE`})
    ORDER BY t.last_message_at DESC
    LIMIT ${limit}
  `
  return rows.map(rowToThread)
}

export async function deleteThread(accountId: string, threadId: string): Promise<void> {
  const files = await sql<{ storage_path: string }[]>`
    SELECT f.storage_path FROM files f
    JOIN messages m ON m.id = f.message_id
    WHERE m.thread_id = ${threadId} AND m.account_id = ${accountId}
  `

  await sql`
    DELETE FROM files WHERE message_id IN (
      SELECT id FROM messages WHERE thread_id = ${threadId} AND account_id = ${accountId}
    )
  `
  await sql`DELETE FROM messages WHERE thread_id = ${threadId} AND account_id = ${accountId}`
  await sql`DELETE FROM threads WHERE id = ${threadId} AND account_id = ${accountId}`

  for (const { storage_path } of files) {
    try { unlinkSync(storage_path) } catch { /* ignore */ }
  }
}

function rowToThread(r: any): ThreadRow {
  return {
    id: r.id,
    accountId: r.account_id,
    workspaceId: r.workspace_id,
    subject: r.subject,
    participants: r.participants,
    messageCount: r.message_count,
    unreadCount: r.unread_count,
    lastMessageAt: r.last_message_at,
    snippet: r.snippet,
    isStarred: r.is_starred,
    snoozedUntil: r.snoozed_until ?? null,
  }
}
