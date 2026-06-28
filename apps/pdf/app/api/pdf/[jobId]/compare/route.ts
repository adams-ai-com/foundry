import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import { fetchProc, assertJobOwner } from '@/lib/proc'

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params
  const deny = await assertJobOwner(jobId, session.userId)
  if (deny) return deny
  // Forward FormData directly (file upload)
  const body = await req.formData()
  const res = await fetchProc(`/compare/${jobId}`, { method: 'POST', body })
  return NextResponse.json(await res.json(), { status: res.status })
}
