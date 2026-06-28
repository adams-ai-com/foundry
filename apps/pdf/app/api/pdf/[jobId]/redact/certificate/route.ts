import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import { fetchProc, assertJobOwner } from '@/lib/proc'

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params
  const deny = await assertJobOwner(jobId, session.userId)
  if (deny) return deny
  const res = await fetchProc(`/redact/${jobId}/certificate`)
  if (!res.ok) return NextResponse.json({ error: 'Certificate not found' }, { status: res.status })
  const data = await res.arrayBuffer()
  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="redaction-certificate-${jobId.slice(0, 8)}.pdf"`,
    },
  })
}
