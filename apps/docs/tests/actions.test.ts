import { describe, it, expect, beforeEach, vi } from 'vitest'
import sql from '../lib/db'
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
} from '../lib/actions'

// Wipe documents table before each test for isolation
beforeEach(async () => {
  await sql`DELETE FROM documents`
  vi.clearAllMocks()
})

// ─── listDocuments ────────────────────────────────────────────────────────────

describe('listDocuments', () => {
  it('returns empty array when no documents exist', async () => {
    const docs = await listDocuments()
    expect(docs).toEqual([])
  })

  it('returns all documents ordered by updated_at desc', async () => {
    await sql`
      INSERT INTO documents (title, content, updated_at) VALUES
        ('Older', '{}', now() - interval '1 hour'),
        ('Newer', '{}', now())
    `
    const docs = await listDocuments()
    expect(docs).toHaveLength(2)
    expect(docs[0].title).toBe('Newer')
    expect(docs[1].title).toBe('Older')
  })

  it('does not return content column (perf: large docs)', async () => {
    await sql`INSERT INTO documents (title, content) VALUES ('X', '{"type":"doc"}')`
    const docs = await listDocuments()
    expect(docs[0]).not.toHaveProperty('content')
  })
})

// ─── getDocument ─────────────────────────────────────────────────────────────

describe('getDocument', () => {
  it('returns null for a non-existent id', async () => {
    const doc = await getDocument('00000000-0000-0000-0000-000000000000')
    expect(doc).toBeNull()
  })

  it('returns the document for a known id', async () => {
    const [{ id }] = await sql<{ id: string }[]>`
      INSERT INTO documents (title, content) VALUES ('Hello', '{"type":"doc"}') RETURNING id
    `
    const doc = await getDocument(id)
    expect(doc).not.toBeNull()
    expect(doc!.title).toBe('Hello')
    expect(doc!.id).toBe(id)
  })

  it('returns the content field', async () => {
    const content = { type: 'doc', content: [{ type: 'paragraph' }] }
    const [{ id }] = await sql<{ id: string }[]>`
      INSERT INTO documents (title, content) VALUES ('Doc', ${sql.json(content as Parameters<typeof sql.json>[0])}) RETURNING id
    `
    const doc = await getDocument(id)
    expect(doc!.content).toMatchObject(content)
  })
})

// ─── createDocument ───────────────────────────────────────────────────────────

describe('createDocument', () => {
  it('inserts a new document with default title Untitled', async () => {
    await createDocument()
    const docs = await listDocuments()
    expect(docs).toHaveLength(1)
    expect(docs[0].title).toBe('Untitled')
  })

  it('calls redirect to /editor/<uuid>', async () => {
    const { redirect } = await import('next/navigation')
    await createDocument()
    expect(redirect).toHaveBeenCalledOnce()
    expect(vi.mocked(redirect).mock.calls[0][0]).toMatch(/^\/editor\/[0-9a-f-]{36}$/)
  })

  it('creates a document with empty content object', async () => {
    await createDocument()
    const [{ id }] = await sql<{ id: string }[]>`SELECT id FROM documents LIMIT 1`
    const doc = await getDocument(id)
    expect(doc!.content).toEqual({})
  })
})

// ─── updateDocument ───────────────────────────────────────────────────────────

describe('updateDocument', () => {
  it('persists a new title', async () => {
    const [{ id }] = await sql<{ id: string }[]>`
      INSERT INTO documents (title, content) VALUES ('Old Title', '{}') RETURNING id
    `
    await updateDocument(id, 'New Title', {})
    const doc = await getDocument(id)
    expect(doc!.title).toBe('New Title')
  })

  it('persists content changes', async () => {
    const [{ id }] = await sql<{ id: string }[]>`
      INSERT INTO documents (title, content) VALUES ('Doc', '{}') RETURNING id
    `
    const newContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
    }
    await updateDocument(id, 'Doc', newContent)
    const doc = await getDocument(id)
    expect(doc!.content).toMatchObject(newContent)
  })

  it('advances updated_at timestamp', async () => {
    const [{ id, updated_at: before }] = await sql<{ id: string; updated_at: Date }[]>`
      INSERT INTO documents (title, content, updated_at)
      VALUES ('Doc', '{}', now() - interval '1 hour') RETURNING id, updated_at
    `
    await updateDocument(id, 'Doc', {})
    const doc = await getDocument(id)
    expect(new Date(doc!.updated_at).getTime()).toBeGreaterThan(new Date(before).getTime())
  })

  it('does not affect other documents', async () => {
    const [{ id: id1 }] = await sql<{ id: string }[]>`
      INSERT INTO documents (title, content) VALUES ('One', '{}') RETURNING id
    `
    const [{ id: id2 }] = await sql<{ id: string }[]>`
      INSERT INTO documents (title, content) VALUES ('Two', '{}') RETURNING id
    `
    await updateDocument(id1, 'One Updated', {})
    const doc2 = await getDocument(id2)
    expect(doc2!.title).toBe('Two')
  })
})

// ─── deleteDocument ───────────────────────────────────────────────────────────

describe('deleteDocument', () => {
  it('removes the document from the database', async () => {
    const [{ id }] = await sql<{ id: string }[]>`
      INSERT INTO documents (title, content) VALUES ('To Delete', '{}') RETURNING id
    `
    await deleteDocument(id)
    const doc = await getDocument(id)
    expect(doc).toBeNull()
  })

  it('calls redirect to /', async () => {
    const { redirect } = await import('next/navigation')
    const [{ id }] = await sql<{ id: string }[]>`
      INSERT INTO documents (title, content) VALUES ('Gone', '{}') RETURNING id
    `
    await deleteDocument(id)
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('does not remove other documents', async () => {
    const [{ id: id1 }] = await sql<{ id: string }[]>`
      INSERT INTO documents (title, content) VALUES ('Delete Me', '{}') RETURNING id
    `
    const [{ id: id2 }] = await sql<{ id: string }[]>`
      INSERT INTO documents (title, content) VALUES ('Keep Me', '{}') RETURNING id
    `
    await deleteDocument(id1)
    const doc2 = await getDocument(id2)
    expect(doc2).not.toBeNull()
    expect(doc2!.title).toBe('Keep Me')
  })

  it('is a no-op for a non-existent id (does not throw)', async () => {
    await expect(
      deleteDocument('00000000-0000-0000-0000-000000000000')
    ).resolves.not.toThrow()
  })
})
