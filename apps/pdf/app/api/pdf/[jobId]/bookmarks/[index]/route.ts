import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc } from '@/lib/proc'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ jobId: string; index: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId, index } = await params
  const res = await fetchProc(`/bookmarks/${jobId}/${index}`, { method: 'DELETE' })
  return NextResponse.json(await res.json(), { status: res.status })
}
