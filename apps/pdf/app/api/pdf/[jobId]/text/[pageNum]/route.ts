import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc } from '@/lib/proc'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string; pageNum: string }> },
) {
  if (!await getSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId, pageNum } = await params
  const res = await fetchProc(`/text/${jobId}/${pageNum}`)
  return NextResponse.json(await res.json(), { status: res.status })
}
