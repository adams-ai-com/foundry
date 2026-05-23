import { createTransport, type SendMailOptions } from 'nodemailer'
import { readFileSync, existsSync } from 'fs'
import { config } from '../config.js'
import { sql, newId } from '../db.js'
import { storeInboundMessage } from '../storage/messages.js'
import { parseMail } from '../parser/mime.js'
import { getFile } from '../storage/files.js'

export interface SendOptions {
  accountId: string
  from: string
  fromName: string
  to: { name?: string; email: string }[]
  cc?: { name?: string; email: string }[]
  bcc?: { name?: string; email: string }[]
  subject: string
  bodyHtml?: string
  bodyText?: string
  inReplyTo?: string
  references?: string
  threadId?: string
  attachmentIds?: string[]
}

function buildTransport() {
  if (config.relay.host) {
    return createTransport({
      host: config.relay.host,
      port: config.relay.port,
      secure: config.relay.port === 465,
      auth: config.relay.user
        ? { user: config.relay.user, pass: config.relay.pass }
        : undefined,
    })
  }
  // Direct delivery fallback (development only)
  return createTransport({ sendmail: true })
}

function loadDkimKey(): string | null {
  if (!config.dkim.privateKeyPath) return null
  if (!existsSync(config.dkim.privateKeyPath)) return null
  return readFileSync(config.dkim.privateKeyPath, 'utf-8')
}

async function logDelivery(
  accountId: string,
  fromEmail: string,
  toCount: number,
  messageId: string | null,
  status: 'sent' | 'failed',
  error?: string,
): Promise<void> {
  try {
    await sql`
      INSERT INTO mail_delivery_log (account_id, from_email, to_count, message_id, status, error)
      VALUES (${accountId}, ${fromEmail}, ${toCount}, ${messageId}, ${status}, ${error ?? null})
    `
  } catch {
    // Never block the caller on log write failure
  }
}

export async function sendMessage(opts: SendOptions): Promise<string> {
  const transport = buildTransport()
  const dkimKey = loadDkimKey()

  const fromDomain = opts.from.split('@')[1] ?? config.domain
  const messageIdValue = `<${newId()}@${fromDomain}>`

  // Resolve file attachments
  const nodemailerAttachments: Array<{ filename: string; path: string; contentType: string }> = []
  if (opts.attachmentIds?.length) {
    for (const fileId of opts.attachmentIds) {
      const file = await getFile(opts.accountId, fileId)
      if (file) {
        nodemailerAttachments.push({
          filename: file.filename,
          path: file.storage_path,
          contentType: file.content_type,
        })
      }
    }
  }

  const mailOptions: SendMailOptions = {
    messageId: messageIdValue,
    from: opts.fromName ? `"${opts.fromName}" <${opts.from}>` : opts.from,
    to: opts.to.map((a) => a.name ? `"${a.name}" <${a.email}>` : a.email),
    cc: opts.cc?.map((a) => a.name ? `"${a.name}" <${a.email}>` : a.email),
    bcc: opts.bcc?.map((a) => a.name ? `"${a.name}" <${a.email}>` : a.email),
    subject: opts.subject,
    html: opts.bodyHtml ?? undefined,
    text: opts.bodyText ?? undefined,
    inReplyTo: opts.inReplyTo ?? undefined,
    references: opts.references ?? undefined,
    attachments: nodemailerAttachments.length ? nodemailerAttachments : undefined,
    ...(dkimKey && {
      dkim: {
        domainName: fromDomain,
        keySelector: config.dkim.selector,
        privateKey: dkimKey,
      },
    }),
  }

  try {
    await transport.sendMail(mailOptions)
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await logDelivery(opts.accountId, opts.from, opts.to.length, messageIdValue, 'failed', errMsg)
    throw err
  }

  // Store a copy in Sent
  const sentParsed = await parseMail(
    `From: ${mailOptions.from}\r\n` +
    `To: ${(mailOptions.to as string[]).join(', ')}\r\n` +
    `Subject: ${opts.subject}\r\n` +
    `Message-ID: ${messageIdValue}\r\n` +
    `Date: ${new Date().toUTCString()}\r\n` +
    `Content-Type: text/html; charset=utf-8\r\n\r\n` +
    (opts.bodyHtml ?? opts.bodyText ?? '')
  )

  // Override toAddrs/ccAddrs with structured data from opts
  sentParsed.toAddrs = opts.to
  sentParsed.ccAddrs = opts.cc ?? []
  if (opts.inReplyTo) sentParsed.inReplyTo = opts.inReplyTo
  if (opts.references) sentParsed.references = opts.references

  const messageId = await storeInboundMessage(opts.accountId, sentParsed, 'inbox' as any)

  // Move from inbox to sent
  await sql`
    UPDATE messages m SET mailbox_id = mb.id, is_read = true
    FROM mailboxes mb
    WHERE mb.account_id = ${opts.accountId} AND mb.type = 'sent'
      AND m.id = ${messageId}
  `

  // Link uploaded attachments to the sent message
  if (opts.attachmentIds?.length) {
    for (const fileId of opts.attachmentIds) {
      await sql`
        UPDATE files SET message_id = ${messageId}
        WHERE id = ${fileId} AND account_id = ${opts.accountId}
      `
    }
  }

  await logDelivery(opts.accountId, opts.from, opts.to.length, messageIdValue, 'sent')

  return messageId
}
