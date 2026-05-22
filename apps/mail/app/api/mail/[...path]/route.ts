import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'

const MAILSERVER_URL = process.env.MAILSERVER_URL ?? 'http://localhost:3100'
const MAILSERVER_API_KEY = process.env.MAILSERVER_API_KEY ?? ''
const MAILSERVER_ACCOUNT_ID = process.env.MAILSERVER_ACCOUNT_ID ?? ''

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { path } = await params
  const upstream = new URL(`${MAILSERVER_URL}/api/v1/${path.join('/')}`)
  req.nextUrl.searchParams.forEach((v, k) => upstream.searchParams.set(k, v))

  const isMultipart = req.headers.get('content-type')?.startsWith('multipart/')
  const canHaveBody = req.method !== 'GET' && req.method !== 'HEAD'

  // Determine body and Content-Type:
  // - Multipart: stream through with original content-type
  // - JSON with actual body text: forward as application/json
  // - DELETE/PATCH with empty body: no body, no Content-Type (Fastify rejects empty JSON)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  let contentType: string | undefined
  if (isMultipart && canHaveBody) {
    body = req.body
    contentType = req.headers.get('content-type') ?? 'multipart/form-data'
  } else if (canHaveBody) {
    const text = await req.text()
    if (text.length > 0) {
      body = text
      contentType = 'application/json'
    }
  }

  const res = await fetch(upstream.toString(), {
    method: req.method,
    headers: {
      ...(contentType ? { 'Content-Type': contentType } : {}),
      'X-API-Key': MAILSERVER_API_KEY,
      'X-Account-Id': MAILSERVER_ACCOUNT_ID,
    },
    // @ts-expect-error — duplex required when body is a ReadableStream in Node fetch
    duplex: isMultipart ? 'half' : undefined,
    body,
  })

  // No-content responses (204, etc.)
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return new NextResponse(null, { status: res.status })
  }

  // File downloads — stream binary response body directly
  const resContentType = res.headers.get('content-type') ?? ''
  if (!resContentType.includes('application/json') && res.body) {
    return new NextResponse(res.body, {
      status: res.status,
      headers: {
        'Content-Type': resContentType,
        'Content-Disposition': res.headers.get('content-disposition') ?? '',
        'Content-Length': res.headers.get('content-length') ?? '',
      },
    })
  }

  const data = await res.json().catch(() => null)
  return NextResponse.json(data, { status: res.status })
}

export const GET = handler
export const POST = handler
export const PATCH = handler
export const DELETE = handler
