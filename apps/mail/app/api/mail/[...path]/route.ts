import { type NextRequest, NextResponse } from 'next/server'

const MAILSERVER_URL = process.env.MAILSERVER_URL ?? 'http://localhost:3100'
const MAILSERVER_API_KEY = process.env.MAILSERVER_API_KEY ?? ''
const MAILSERVER_ACCOUNT_ID = process.env.MAILSERVER_ACCOUNT_ID ?? ''

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const upstream = new URL(`${MAILSERVER_URL}/api/v1/${path.join('/')}`)
  req.nextUrl.searchParams.forEach((v, k) => upstream.searchParams.set(k, v))

  const isMultipart = req.headers.get('content-type')?.startsWith('multipart/')
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'

  // For multipart uploads, stream the body through with the original content-type.
  // For everything else, pass as text with JSON content-type.
  const body = hasBody ? (isMultipart ? req.body : await req.text()) : undefined

  const contentType = isMultipart
    ? (req.headers.get('content-type') ?? 'multipart/form-data')
    : 'application/json'

  const res = await fetch(upstream.toString(), {
    method: req.method,
    headers: {
      'Content-Type': contentType,
      'X-API-Key': MAILSERVER_API_KEY,
      'X-Account-Id': MAILSERVER_ACCOUNT_ID,
    },
    // @ts-expect-error — duplex required when body is a ReadableStream in Node fetch
    duplex: isMultipart ? 'half' : undefined,
    body,
  })

  // File downloads — stream the response body directly
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
