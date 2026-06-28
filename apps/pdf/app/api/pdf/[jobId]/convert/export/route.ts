import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import { fetchProc, assertJobOwner } from '@/lib/proc'

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params
  const deny = await assertJobOwner(jobId, session.userId)
  if (deny) return deny
  const format = req.nextUrl.searchParams.get('format') ?? ''
  const res = await fetchProc(`/convert/${jobId}/export?format=${encodeURIComponent(format)}`)
  if (!res.ok) return NextResponse.json(await res.json(), { status: res.status })
  const blob = await res.blob()
  return new NextResponse(blob.stream(), {
    status: 200,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/octet-stream',
      'Content-Disposition': res.headers.get('Content-Disposition') ?? 'attachment',
    },
  })
}
