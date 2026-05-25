import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc } from '@/lib/proc'

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params
  // Forward FormData directly (file upload)
  const body = await req.formData()
  const res = await fetchProc(`/compare/${jobId}`, { method: 'POST', body })
  return NextResponse.json(await res.json(), { status: res.status })
}
