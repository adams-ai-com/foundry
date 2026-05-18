import { createTransport, type SendMailOptions } from 'nodemailer'
import { readFileSync, existsSync } from 'fs'
import { config } from '../config.js'
import { sql, newId } from '../db.js'
import { storeInboundMessage } from '../storage/messages.js'
import { parseMail } from '../parser/mime.js'

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

export async function sendMessage(opts: SendOptions): Promise<string> {
  const transport = buildTransport()
  const dkimKey = loadDkimKey()

  const fromDomain = opts.from.split('@')[1] ?? config.domain
  const messageIdValue = `<${newId()}@${fromDomain}>`

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
    ...(dkimKey && {
      dkim: {
        domainName: fromDomain,
        keySelector: config.dkim.selector,
        privateKey: dkimKey,
      },
    }),
  }

  await transport.sendMail(mailOptions)

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

  return messageId
}
