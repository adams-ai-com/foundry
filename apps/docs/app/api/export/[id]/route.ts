import { NextResponse } from 'next/server'
import { getDocument } from '@/lib/actions'
import { exportDocxBuffer } from '@/lib/docx-export'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const doc = await getDocument(id)
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const buf = await exportDocxBuffer(doc.content as Record<string, unknown>, doc.title)

  const safe = doc.title.replace(/[^a-z0-9_\-. ]/gi, '_').trim() || 'document'
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safe}.docx"`,
    },
  })
}
