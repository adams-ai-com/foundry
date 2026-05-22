import { NextResponse } from 'next/server'
import { restoreVersion } from '@/lib/actions'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string; vid: string }> }

export async function POST(_req: Request, { params }: RouteParams) {
  const { id, vid } = await params
  const result = await restoreVersion(id, vid)
  if (!result) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  return NextResponse.json({ content: result.content, title: result.title })
}
