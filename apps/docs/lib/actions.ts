'use server'

import { redirect } from 'next/navigation'
import sql from './db'

export type Document = {
  id: string
  title: string
  content: object
  created_at: string
  updated_at: string
}

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
}

export async function deleteDocument(id: string) {
  await sql`DELETE FROM documents WHERE id = ${id}`
  redirect('/')
}
