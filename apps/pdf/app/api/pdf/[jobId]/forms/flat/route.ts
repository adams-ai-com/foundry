import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc } from '@/lib/proc'

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params
  const res = await fetchProc(`/forms/${jobId}/flat`)
  if (!res.ok) return NextResponse.json({ error: 'Flatten failed' }, { status: res.status })
  const buf = await res.arrayBuffer()
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="flattened.pdf"',
    },
  })
}
