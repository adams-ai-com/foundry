import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const procUrl = process.env.FOUNDRY_PDF_PROC_URL ?? 'http://127.0.0.1:3200'
  const secret  = process.env.FOUNDRY_PDF_PROC_SECRET ?? ''

  const upstream = new FormData()
  upstream.append('file', file)
  upstream.append('creator_id', session?.userId ?? '')

  const res = await fetch(`${procUrl}/upload`, {
    method: 'POST',
    headers: { 'X-Proc-Secret': secret },
    body: upstream,
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text }, { status: 502 })
  }

  return NextResponse.json(await res.json())
}
