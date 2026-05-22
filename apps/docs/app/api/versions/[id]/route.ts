import { NextRequest, NextResponse } from 'next/server'
import { listVersions, saveNamedVersion, getDocument } from '@/lib/actions'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const versions = await listVersions(id)
  return NextResponse.json(versions)
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const { label } = await req.json()
  if (!label?.trim()) return NextResponse.json({ error: 'Label required' }, { status: 400 })

  const doc = await getDocument(id)
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await saveNamedVersion(id, doc.title, doc.content, label.trim())
  return NextResponse.json({ ok: true })
}
