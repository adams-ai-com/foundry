import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const rows = await sql<{ filename: string; mime_type: string; content: Buffer }[]>`
    SELECT filename, mime_type, content FROM cr_attachments WHERE id = ${id}
  `
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { filename, mime_type, content } = rows[0]
  return new NextResponse(new Uint8Array(content), {
    headers: {
      'Content-Type': mime_type,
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
