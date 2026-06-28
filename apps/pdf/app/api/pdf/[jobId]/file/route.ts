import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import { assertJobOwner } from '@/lib/proc'

interface Params {
  params: Promise<{ jobId: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  const { jobId } = await params
  const deny = await assertJobOwner(jobId, session.userId)
  if (deny) return deny
  const procUrl = process.env.FOUNDRY_PDF_PROC_URL ?? 'http://127.0.0.1:3200'
  const secret  = process.env.FOUNDRY_PDF_PROC_SECRET ?? ''

  const res = await fetch(`${procUrl}/file/${jobId}`, {
    headers: { 'X-Proc-Secret': secret },
    cache: 'no-store',
  })

  if (!res.ok) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
    },
  })
}
