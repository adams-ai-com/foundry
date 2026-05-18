import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { sql, newId } from '../db.js'
import { config } from '../config.js'
import type { ParsedAttachment } from '../parser/mime.js'

export interface FileRow {
  id: string
  accountId: string
  messageId: string | null
  filename: string
  contentType: string
  size: number
  storagePath: string
  createdAt: Date
}

export async function storeAttachments(
  accountId: string,
  messageId: string,
  attachments: ParsedAttachment[],
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

export async function listFiles(
  accountId: string,
  opts: { limit?: number; offset?: number; search?: string } = {},
): Promise<{ files: FileRow[]; total: number }> {
  const { limit = 50, offset = 0, search } = opts

  const where = search
    ? sql`account_id = ${accountId} AND filename ILIKE ${'%' + search + '%'}`
    : sql`account_id = ${accountId}`

  const [{ count }] = await sql<{ count: string }[]>`SELECT COUNT(*) FROM files WHERE ${where}`

  const rows = await sql<FileRow[]>`
    SELECT id, account_id, message_id, filename, content_type, size, storage_path, created_at
    FROM files WHERE ${where}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}`

  return { files: rows, total: Number(count) }
}

export async function uploadFile(
  accountId: string,
  input: { filename: string; contentType: string; data: Buffer },
): Promise<FileRow> {
  const dir = join(config.attachmentsDir, accountId)
  mkdirSync(dir, { recursive: true })

  const fileId = newId()
  const storagePath = join(dir, fileId)
  writeFileSync(storagePath, input.data)

  const [row] = await sql<FileRow[]>`
    INSERT INTO files (id, account_id, filename, content_type, size, storage_path)
    VALUES (${fileId}, ${accountId}, ${input.filename}, ${input.contentType}, ${input.data.length}, ${storagePath})
    RETURNING id, account_id, message_id, filename, content_type, size, storage_path, created_at`

  return row
}

export async function deleteFile(accountId: string, fileId: string): Promise<boolean> {
  const file = await getFile(accountId, fileId)
  if (!file) return false

  const result = await sql`DELETE FROM files WHERE id = ${fileId} AND account_id = ${accountId}`
  if (result.count > 0 && existsSync(file.storage_path)) {
    unlinkSync(file.storage_path)
  }
  return result.count > 0
}
