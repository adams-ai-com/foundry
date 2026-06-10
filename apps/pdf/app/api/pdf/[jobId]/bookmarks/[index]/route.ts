import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc, assertJobOwner } from '@/lib/proc'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ jobId: string; index: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId, index } = await params
  const deny = await assertJobOwner(jobId, session.userId)
  if (deny) return deny
  const res = await fetchProc(`/bookmarks/${jobId}/${index}`, { method: 'DELETE' })
  return NextResponse.json(await res.json(), { status: res.status })
}
