import { NextResponse } from 'next/server'
import { resolveComment, reopenComment } from '@/lib/actions'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string; cid: string }> }

export async function POST(req: Request, { params }: RouteParams) {
  const { cid } = await params
  const body = await req.json().catch(() => ({}))
  if (body.reopen) {
    await reopenComment(cid)
  } else {
    await resolveComment(cid)
  }
  return NextResponse.json({ ok: true })
}
