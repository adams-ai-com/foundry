import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB
const FETCH_TIMEOUT_MS = 20_000

// Block private/loopback ranges to prevent SSRF
function isPrivateUrl(raw: string): boolean {
  let url: URL
  try { url = new URL(raw) } catch { return true }
  if (url.protocol !== 'https:') return true
  const h = url.hostname
  if (h === 'localhost') return true
  const parts = h.split('.').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return false
  const [a, b] = parts
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  )
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url } = await req.json().catch(() => ({})) as { url?: string }
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url required' }, { status: 400 })
  }
  if (isPrivateUrl(url)) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  // Fetch the PDF with timeout and size limit
  let pdfBuf: ArrayBuffer
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/pdf,*/*' },
    })
    clearTimeout(timer)
    if (!res.ok) return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: 422 })

    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('pdf') && !url.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'URL does not point to a PDF' }, { status: 422 })
    }

    const reader = res.body?.getReader()
    if (!reader) return NextResponse.json({ error: 'Empty response' }, { status: 422 })

    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) {
        reader.cancel()
        return NextResponse.json({ error: 'PDF exceeds 50 MB limit' }, { status: 422 })
      }
      chunks.push(value)
    }
    // Merge into a plain ArrayBuffer (Uint8Array<ArrayBufferLike> is not a valid BlobPart)
    pdfBuf = new ArrayBuffer(total)
    const view = new Uint8Array(pdfBuf)
    let off = 0
    for (const c of chunks) { view.set(c, off); off += c.byteLength }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not fetch PDF: ${msg}` }, { status: 422 })
  }

  // Forward to pdf-proc as a file upload (same path as /api/pdf/upload)
  const procUrl = process.env.FOUNDRY_PDF_PROC_URL ?? 'http://127.0.0.1:3200'
  const secret  = process.env.FOUNDRY_PDF_PROC_SECRET ?? ''

  const fileName = new URL(url).pathname.split('/').pop() || 'document.pdf'
  const file = new File([pdfBuf], fileName, { type: 'application/pdf' })

  const upstream = new FormData()
  upstream.append('file', file)
  upstream.append('creator_id', session.userId)

  const res = await fetch(`${procUrl}/upload`, {
    method: 'POST',
    headers: { 'X-Proc-Secret': secret },
    body: upstream,
  })

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: 502 })
  }
  return NextResponse.json(await res.json())
}
