import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc } from '@/lib/proc'

export async function GET(_: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params
  const res = await fetchProc(`/info/${jobId}`)
  if (!res.ok) return NextResponse.json({ error: 'Not found' }, { status: res.status })
  return NextResponse.json(await res.json())
}
