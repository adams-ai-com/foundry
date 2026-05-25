import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/tokens'
import { db } from '@/lib/db'
import { fetchProc } from '@/lib/proc'

type Params = { params: Promise<{ token: string; pageNum: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { token, pageNum } = await params

  const payload = verifyToken(token)
  if (!payload) return new NextResponse('Invalid token', { status: 401 })

  // Confirm envelope is still active (token is structurally valid — just check envelope exists)
  const rows = await db`
    SELECT e.status, e.id AS envelope_id
    FROM envelope_recipients r
    JOIN envelopes e ON e.id = r.envelope_id
    WHERE r.id = ${payload.r} AND e.id = ${payload.e}
  `
  const ctx = rows[0] as any
  if (!ctx) return new NextResponse('Not found', { status: 404 })
  if (ctx.status === 'voided') return new NextResponse('Voided', { status: 410 })

  const res = await fetchProc(`/envelope-sign/page/${ctx.envelope_id}/${pageNum}`)
  if (!res.ok) return new NextResponse('Page not found', { status: res.status })

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=300',
    },
  })
}
