import { sql, newId } from '../db.js'
import { resolveThread, updateThreadMeta } from '../parser/thread.js'
import { storeAttachments } from './files.js'
import { getMailboxId, refreshMailboxCounts } from './mailboxes.js'
import type { ParsedMessage } from '../parser/mime.js'

export interface MessageRow {
  id: string
  accountId: string
  mailboxId: string
  threadId: string | null
  protocol: 'smtp' | 'internal'
  subject: string
  fromName: string | null
  fromEmail: string
  toAddrs: { name?: string; email: string }[]
  ccAddrs: { name?: string; email: string }[]
  date: Date
  bodyHtml: string | null
  bodyText: string | null
  isRead: boolean
  isStarred: boolean
  isDraft: boolean
  receivedAt: Date
}

export async function storeInboundMessage(
  accountId: string,
  parsed: ParsedMessage,
  mailboxType: 'inbox' | 'spam' = 'inbox'
): Promise<string> {
  const messageId = newId()
  const mailboxId = await getMailboxId(accountId, mailboxType)

  const threadId = await resolveThread(accountId, {
    messageId: parsed.messageId,
    inReplyTo: parsed.inReplyTo,
    references: parsed.references,
    subject: parsed.subject,
    fromEmail: parsed.fromEmail,
    fromName: parsed.fromName,
    toAddrs: parsed.toAddrs,
    date: parsed.date,
  })

  await sql`
    INSERT INTO messages (
      id, account_id, mailbox_id, thread_id, protocol,
      message_id, in_reply_to, message_refs,
      subject, from_name, from_email, to_addrs, cc_addrs,
      date, body_html, body_text, raw_size, is_read
    ) VALUES (
      ${messageId}, ${accountId}, ${mailboxId}, ${threadId}, 'smtp',
      ${parsed.messageId}, ${parsed.inReplyTo}, ${parsed.references},
      ${parsed.subject}, ${parsed.fromName}, ${parsed.fromEmail},
      ${sql.json(parsed.toAddrs)}, ${sql.json(parsed.ccAddrs)},
      ${parsed.date}, ${parsed.bodyHtml}, ${parsed.bodyText},
      ${parsed.rawSize}, false
    )
    ON CONFLICT (message_id) DO NOTHING
  `

  if (parsed.attachments.length > 0) {
    await storeAttachments(accountId, messageId, parsed.attachments)
  }

  await updateThreadMeta(threadId, accountId)
  await refreshMailboxCounts(accountId)

  return messageId
}

export async function getMessage(accountId: string, messageId: string): Promise<MessageRow | null> {
  const rows = await sql<any[]>`
    SELECT * FROM messages WHERE id = ${messageId} AND account_id = ${accountId} LIMIT 1
  `
  if (!rows.length) return null
  return rowToMessage(rows[0])
}

export async function markRead(accountId: string, messageId: string, isRead: boolean): Promise<void> {
  await sql`
    UPDATE messages SET is_read = ${isRead}
    WHERE id = ${messageId} AND account_id = ${accountId}
  `
  const msg = await sql<{ thread_id: string }[]>`
    SELECT thread_id FROM messages WHERE id = ${messageId}
  `
  if (msg[0]?.thread_id) await updateThreadMeta(msg[0].thread_id, accountId)
  await refreshMailboxCounts(accountId)
}

export async function markStarred(accountId: string, messageId: string, isStarred: boolean): Promise<void> {
  await sql`
    UPDATE messages SET is_starred = ${isStarred}
    WHERE id = ${messageId} AND account_id = ${accountId}
  `
}

export async function moveToMailbox(accountId: string, messageId: string, targetType: string): Promise<void> {
  const mailboxId = await getMailboxId(accountId, targetType as any)
  await sql`
    UPDATE messages SET mailbox_id = ${mailboxId}
    WHERE id = ${messageId} AND account_id = ${accountId}
  `
  await refreshMailboxCounts(accountId)
}

function rowToMessage(r: any): MessageRow {
  return {
    id: r.id, accountId: r.account_id, mailboxId: r.mailbox_id,
    threadId: r.thread_id, protocol: r.protocol,
    subject: r.subject, fromName: r.from_name, fromEmail: r.from_email,
    toAddrs: r.to_addrs, ccAddrs: r.cc_addrs,
    date: r.date, bodyHtml: r.body_html, bodyText: r.body_text,
    isRead: r.is_read, isStarred: r.is_starred, isDraft: r.is_draft,
    receivedAt: r.received_at,
  }
}
