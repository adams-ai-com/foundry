import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc, assertJobOwner } from '@/lib/proc'

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params
  const deny = await assertJobOwner(jobId, session.userId)
  if (deny) return deny
  const q = req.nextUrl.searchParams.get('q') ?? ''
  const res = await fetchProc(`/search/${jobId}?q=${encodeURIComponent(q)}`)
  return NextResponse.json(await res.json(), { status: res.status })
}
