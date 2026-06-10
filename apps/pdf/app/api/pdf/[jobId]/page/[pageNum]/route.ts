import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc, assertJobOwner } from '@/lib/proc'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string; pageNum: string }> },
) {
  const session = await getSession()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })
  const { jobId, pageNum } = await params
  const deny = await assertJobOwner(jobId, session.userId)
  if (deny) return deny
  const scale = req.nextUrl.searchParams.get('scale') ?? '1.5'
  const res = await fetchProc(`/page/${jobId}/${pageNum}?scale=${scale}`)
  if (!res.ok) return new NextResponse('Not found', { status: res.status })
  return new NextResponse(res.body, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  })
}
