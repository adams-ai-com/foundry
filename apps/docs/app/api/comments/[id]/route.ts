import { NextRequest, NextResponse } from 'next/server'
import { listComments, addComment } from '@/lib/actions'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const comments = await listComments(id)
  return NextResponse.json(comments)
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })
  await addComment(id, content.trim())
  return NextResponse.json({ ok: true })
}
