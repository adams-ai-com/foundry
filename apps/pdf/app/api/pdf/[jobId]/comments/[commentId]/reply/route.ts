import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import { fetchProc, assertJobOwner } from '@/lib/proc'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string; commentId: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId, commentId } = await params
  const deny = await assertJobOwner(jobId, session.userId)
  if (deny) return deny
  const body = await req.json()
  const res = await fetchProc(`/comments/${jobId}/${commentId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
