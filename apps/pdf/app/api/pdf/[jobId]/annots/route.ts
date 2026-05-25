import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc } from '@/lib/proc'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params
  const res = await fetchProc(`/annots/${jobId}`)
  return NextResponse.json(await res.json(), { status: res.status })
}
