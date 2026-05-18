import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { sql, newId } from '../db.js'
import { config } from '../config.js'
import type { ParsedAttachment } from '../parser/mime.js'

export async function storeAttachments(
  accountId: string,
  messageId: string,
  attachments: ParsedAttachment[]
): Promise<void> {
  const dir = join(config.attachmentsDir, accountId)
  mkdirSync(dir, { recursive: true })

  for (const att of attachments) {
    const fileId = newId()
    const storagePath = join(dir, fileId)
    writeFileSync(storagePath, att.content)

    await sql`
      INSERT INTO files (id, account_id, message_id, filename, content_type, size, storage_path)
      VALUES (${fileId}, ${accountId}, ${messageId}, ${att.filename}, ${att.contentType}, ${att.size}, ${storagePath})
    `
  }
}

export async function getFile(accountId: string, fileId: string) {
  const rows = await sql<{ id: string; filename: string; content_type: string; size: number; storage_path: string }[]>`
    SELECT id, filename, content_type, size, storage_path
    FROM files WHERE id = ${fileId} AND account_id = ${accountId} LIMIT 1
  `
  return rows[0] ?? null
}

export async function listMessageFiles(messageId: string) {
  return sql<{ id: string; filename: string; content_type: string; size: number }[]>`
    SELECT id, filename, content_type, size FROM files WHERE message_id = ${messageId}
  `
}
