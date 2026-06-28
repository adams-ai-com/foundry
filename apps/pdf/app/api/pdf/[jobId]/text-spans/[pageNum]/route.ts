import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import { fetchProc, assertJobOwner } from '@/lib/proc'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string; pageNum: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId, pageNum } = await params
  const deny = await assertJobOwner(jobId, session.userId)
  if (deny) return deny
  const res = await fetchProc(`/text-spans/${jobId}/${pageNum}`)
  return NextResponse.json(await res.json(), { status: res.status })
}
