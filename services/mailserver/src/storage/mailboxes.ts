import { sql, newId } from '../db.js'

export type MailboxType = 'inbox' | 'sent' | 'drafts' | 'archive' | 'trash' | 'spam' | 'custom'

export interface Mailbox {
  id: string
  accountId: string
  name: string
  type: MailboxType
  path: string
  totalCount: number
  unreadCount: number
}

const SYSTEM_MAILBOXES: { name: string; type: MailboxType }[] = [
  { name: 'Inbox', type: 'inbox' },
  { name: 'Sent', type: 'sent' },
  { name: 'Drafts', type: 'drafts' },
  { name: 'Archive', type: 'archive' },
  { name: 'Trash', type: 'trash' },
  { name: 'Spam', type: 'spam' },
]

export async function ensureSystemMailboxes(accountId: string): Promise<void> {
  for (const mb of SYSTEM_MAILBOXES) {
    await sql`
      INSERT INTO mailboxes (id, account_id, name, type, path)
      VALUES (${newId()}, ${accountId}, ${mb.name}, ${mb.type}, ${mb.type})
      ON CONFLICT (account_id, path) DO NOTHING
    `
  }
}

export async function getMailboxId(accountId: string, type: MailboxType): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM mailboxes WHERE account_id = ${accountId} AND type = ${type} LIMIT 1
  `
  if (!rows.length) throw new Error(`Mailbox ${type} not found for account ${accountId}`)
  return rows[0].id
}

export async function listMailboxes(accountId: string): Promise<Mailbox[]> {
  const rows = await sql<{
    id: string; account_id: string; name: string; type: string;
    path: string; total_count: number; unread_count: number
  }[]>`
    SELECT id, account_id, name, type, path, total_count, unread_count
    FROM mailboxes WHERE account_id = ${accountId}
    ORDER BY
      CASE type WHEN 'inbox' THEN 0 WHEN 'drafts' THEN 1 WHEN 'sent' THEN 2
                WHEN 'archive' THEN 3 WHEN 'spam' THEN 4 WHEN 'trash' THEN 5
                ELSE 10 END
  `
  return rows.map((r) => ({
    id: r.id, accountId: r.account_id, name: r.name,
    type: r.type as MailboxType, path: r.path,
    totalCount: r.total_count, unreadCount: r.unread_count,
  }))
}

export async function refreshMailboxCounts(accountId: string): Promise<void> {
  await sql`
    UPDATE mailboxes mb SET
      total_count = (SELECT COUNT(*) FROM messages m WHERE m.mailbox_id = mb.id),
      unread_count = (SELECT COUNT(*) FROM messages m WHERE m.mailbox_id = mb.id AND NOT m.is_read AND NOT m.is_draft)
    WHERE mb.account_id = ${accountId}
  `
}
