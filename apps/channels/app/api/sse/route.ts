import { NextRequest } from 'next/server'
import { getSession } from '@foundry/auth'
import { addSSEClient } from '@/lib/sse'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return new Response('Unauthorized', { status: 401 })

  const orgId = session.orgId
  const encoder = new TextEncoder()
  let cleanup: (() => void) | undefined

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }
      cleanup = addSSEClient(orgId, send)
      send({ type: 'connected' })

      // keepalive every 25 s
      const timer = setInterval(() => {
        try { controller.enqueue(encoder.encode(': keepalive\n\n')) } catch {}
      }, 25_000)

      const origCleanup = cleanup
      cleanup = () => { origCleanup(); clearInterval(timer) }
    },
    cancel() { cleanup?.() },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
