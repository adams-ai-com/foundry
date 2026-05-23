import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc, procHeaders } from '@/lib/proc'

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params
  const formData = await req.formData()
  const res = await fetchProc(`/merge/${jobId}`, {
    method: 'POST',
    body: formData,
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
