import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc, procHeaders, assertJobOwner } from '@/lib/proc'

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params
  const deny = await assertJobOwner(jobId, session.userId)
  if (deny) return deny
  const formData = await req.formData()
  const file = formData.get("file")
  if (file instanceof File && file.size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 100 MB)" }, { status: 413 })
  }
  const res = await fetchProc(`/merge/${jobId}`, {
    method: 'POST',
    body: formData,
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
