import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc } from '@/lib/proc'

export async function POST(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.formData()
  const res = await fetchProc('/convert/import', { method: 'POST', body })
  return NextResponse.json(await res.json(), { status: res.status })
}
