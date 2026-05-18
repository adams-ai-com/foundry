import { simpleParser, type ParsedMail, type Attachment } from 'mailparser'
import type { Readable } from 'stream'

export interface ParsedMessage {
  messageId: string | null
  inReplyTo: string | null
  references: string | null
  subject: string
  fromEmail: string
  fromName: string | null
  toAddrs: { name?: string; email: string }[]
  ccAddrs: { name?: string; email: string }[]
  date: Date
  bodyHtml: string | null
  bodyText: string | null
  attachments: ParsedAttachment[]
  rawSize: number
}

export interface ParsedAttachment {
  filename: string
  contentType: string
  size: number
  content: Buffer
}

function extractAddresses(field: ParsedMail['to']): { name?: string; email: string }[] {
  if (!field) return []
  const arr = Array.isArray(field) ? field : [field]
  return arr.flatMap((af) =>
    af.value.map((a) => ({ name: a.name || undefined, email: a.address ?? '' }))
  ).filter((a) => a.email)
}

export async function parseMail(source: Readable | Buffer | string): Promise<ParsedMessage> {
  const parsed = await simpleParser(source as Parameters<typeof simpleParser>[0])

  const fromValue = parsed.from?.value[0]
  const fromEmail = fromValue?.address ?? 'unknown@unknown'
  const fromName = fromValue?.name || null

  const attachments: ParsedAttachment[] = (parsed.attachments ?? [])
    .filter((a: Attachment) => a.content && a.filename)
    .map((a: Attachment) => ({
      filename: a.filename ?? 'attachment',
      contentType: a.contentType,
      size: a.size ?? a.content.length,
      content: a.content,
    }))

  const rawSize =
    typeof source === 'string' ? Buffer.byteLength(source) :
    Buffer.isBuffer(source) ? source.length : 0

  return {
    messageId: parsed.messageId ?? null,
    inReplyTo: parsed.inReplyTo ?? null,
    references: Array.isArray(parsed.references)
      ? parsed.references.join(' ')
      : (parsed.references ?? null),
    subject: parsed.subject ?? '(no subject)',
    fromEmail,
    fromName,
    toAddrs: extractAddresses(parsed.to),
    ccAddrs: extractAddresses(parsed.cc),
    date: parsed.date ?? new Date(),
    bodyHtml: parsed.html || null,
    bodyText: parsed.text || null,
    attachments,
    rawSize,
  }
}
