import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc } from '@/lib/proc'

// Returns { available: bool } — whether a redaction certificate exists for this job
export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params
  const res = await fetchProc(`/redact/${jobId}/certificate`, { method: 'HEAD' })
  return NextResponse.json({ available: res.ok })
}

// Apply redactions — returns { jobId: string, certificateAvailable: true }
export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params
  const body = await req.json()
  const res = await fetchProc(`/redact/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
