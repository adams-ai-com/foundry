import { NextRequest, NextResponse } from 'next/server'
import { readFile, unlink } from 'fs/promises'
import sql from '@/lib/db'

const INLINE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'text/plain', 'text/html',
])

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const rows = await sql<{ name: string; mimeType: string; storagePath: string }[]>`
    SELECT name, mime_type, storage_path FROM site_files WHERE id = ${id}`

  if (!rows[0]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { name, mimeType, storagePath } = rows[0]

  let buffer: Buffer
  try {
    buffer = await readFile(storagePath)
  } catch {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
  }

  const disposition = INLINE_TYPES.has(mimeType)
    ? `inline; filename="${encodeURIComponent(name)}"`
    : `attachment; filename="${encodeURIComponent(name)}"`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type':        mimeType,
      'Content-Disposition': disposition,
      'Content-Length':      buffer.length.toString(),
      'Cache-Control':       'private, max-age=3600',
    },
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const rows = await sql<{ storagePath: string }[]>`
    DELETE FROM site_files WHERE id = ${id} RETURNING storage_path`

  if (rows[0]) {
    try { await unlink(rows[0].storagePath) } catch { /* already gone */ }
  }

  return NextResponse.json({ ok: true })
}
