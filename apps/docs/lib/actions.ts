'use server'

import { redirect } from 'next/navigation'
import { createHash } from 'crypto'
import sql from './db'

export type Document = {
  id: string
  title: string
  content: object
  created_at: string
  updated_at: string
}

export type DocumentVersion = {
  id: string
  document_id: string
  title: string
  content: object
  content_hash: string
  label: string | null
  created_at: string
}

export type DocumentComment = {
  id: string
  document_id: string
  content: string
  resolved: boolean
  created_at: string
  resolved_at: string | null
}

function contentHash(content: object): string {
  return createHash('md5').update(JSON.stringify(content)).digest('hex')
}

// Documents

export async function listDocuments(): Promise<Document[]> {
  return sql<Document[]>`
    SELECT id, title, created_at, updated_at
    FROM documents
    ORDER BY updated_at DESC
  `
}

export async function getDocument(id: string): Promise<Document | null> {
  const rows = await sql<Document[]>`
    SELECT id, title, content, created_at, updated_at
    FROM documents
    WHERE id = ${id}
  `
  return rows[0] ?? null
}

export async function createDocument() {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO documents (title, content)
    VALUES ('Untitled', '{}')
    RETURNING id
  `
  redirect(`/editor/${rows[0].id}`)
}

export async function updateDocument(id: string, title: string, content: Record<string, unknown>) {
  await sql`
    UPDATE documents
    SET title = ${title}, content = ${sql.json(content as Parameters<typeof sql.json>[0])}, updated_at = now()
    WHERE id = ${id}
  `
  await autoCheckpoint(id, title, content)
}

export async function deleteDocument(id: string) {
  await sql`DELETE FROM documents WHERE id = ${id}`
  redirect('/')
}

// Versions

async function autoCheckpoint(documentId: string, title: string, content: object) {
  const hash = contentHash(content)
  // Insert only if content changed AND no checkpoint in last 60 seconds
  await sql`
    INSERT INTO document_versions (document_id, title, content, content_hash)
    SELECT ${documentId}, ${title}, ${sql.json(content as Parameters<typeof sql.json>[0])}, ${hash}
    WHERE NOT EXISTS (
      SELECT 1 FROM document_versions v
      WHERE v.document_id = ${documentId}
      AND v.content_hash = ${hash}
    )
    AND NOT EXISTS (
      SELECT 1 FROM document_versions v
      WHERE v.document_id = ${documentId}
      AND v.created_at > now() - INTERVAL '60 seconds'
    )
  `
}

export async function saveNamedVersion(documentId: string, title: string, content: object, label: string) {
  const hash = contentHash(content)
  await sql`
    INSERT INTO document_versions (document_id, title, content, content_hash, label)
    VALUES (${documentId}, ${title}, ${sql.json(content as Parameters<typeof sql.json>[0])}, ${hash}, ${label})
  `
}

export async function listVersions(documentId: string): Promise<DocumentVersion[]> {
  return sql<DocumentVersion[]>`
    SELECT id, document_id, title, content_hash, label, created_at
    FROM document_versions
    WHERE document_id = ${documentId}
    ORDER BY created_at DESC
    LIMIT 100
  `
}

export async function getVersion(versionId: string): Promise<DocumentVersion | null> {
  const rows = await sql<DocumentVersion[]>`
    SELECT id, document_id, title, content, content_hash, label, created_at
    FROM document_versions
    WHERE id = ${versionId}
  `
  return rows[0] ?? null
}

export async function restoreVersion(documentId: string, versionId: string) {
  const version = await getVersion(versionId)
  if (!version || version.document_id !== documentId) return null
  await sql`
    UPDATE documents
    SET title = ${version.title}, content = ${sql.json(version.content as Parameters<typeof sql.json>[0])}, updated_at = now()
    WHERE id = ${documentId}
  `
  // Record the restore as a named version
  const hash = contentHash(version.content)
  await sql`
    INSERT INTO document_versions (document_id, title, content, content_hash, label)
    VALUES (${documentId}, ${version.title}, ${sql.json(version.content as Parameters<typeof sql.json>[0])}, ${hash}, 'Restored')
  `
  return version
}

// Comments

export async function listComments(documentId: string): Promise<DocumentComment[]> {
  return sql<DocumentComment[]>`
    SELECT id, document_id, content, resolved, created_at, resolved_at
    FROM document_comments
    WHERE document_id = ${documentId}
    ORDER BY created_at DESC
  `
}

export async function addComment(documentId: string, content: string) {
  await sql`
    INSERT INTO document_comments (document_id, content)
    VALUES (${documentId}, ${content})
  `
}

export async function resolveComment(commentId: string) {
  await sql`
    UPDATE document_comments
    SET resolved = true, resolved_at = now()
    WHERE id = ${commentId}
  `
}

export async function reopenComment(commentId: string) {
  await sql`
    UPDATE document_comments
    SET resolved = false, resolved_at = null
    WHERE id = ${commentId}
  `
}
