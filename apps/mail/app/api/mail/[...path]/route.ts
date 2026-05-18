import { type NextRequest, NextResponse } from 'next/server'

const MAILSERVER_URL = process.env.MAILSERVER_URL ?? 'http://localhost:3100'
const MAILSERVER_API_KEY = process.env.MAILSERVER_API_KEY ?? ''
const MAILSERVER_ACCOUNT_ID = process.env.MAILSERVER_ACCOUNT_ID ?? ''

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const upstream = new URL(`${MAILSERVER_URL}/api/v1/${path.join('/')}`)

  req.nextUrl.searchParams.forEach((v, k) => upstream.searchParams.set(k, v))

  const body =
    req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined

  const res = await fetch(upstream.toString(), {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MAILSERVER_API_KEY,
      'X-Account-Id': MAILSERVER_ACCOUNT_ID,
    },
    body,
  })

  const data = await res.json().catch(() => null)
  return NextResponse.json(data, { status: res.status })
}

export const GET = handler
export const POST = handler
export const PATCH = handler
export const DELETE = handler
