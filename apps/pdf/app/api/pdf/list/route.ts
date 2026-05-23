import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const procUrl = process.env.FOUNDRY_PDF_PROC_URL ?? 'http://127.0.0.1:3200'
  const secret  = process.env.FOUNDRY_PDF_PROC_SECRET ?? ''

  try {
    const res = await fetch(`${procUrl}/list`, {
      headers: { 'X-Proc-Secret': secret },
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ files: [] })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ files: [] })
  }
}
