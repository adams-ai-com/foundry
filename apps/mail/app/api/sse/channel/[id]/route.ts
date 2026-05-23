import { type NextRequest } from 'next/server'
import { getSession } from '@foundry/auth'

export const dynamic = 'force-dynamic'

const MAILSERVER_URL = process.env.MAILSERVER_URL ?? 'http://localhost:3100'
const MAILSERVER_API_KEY = process.env.MAILSERVER_API_KEY ?? ''
const MAILSERVER_ACCOUNT_ID = process.env.MAILSERVER_ACCOUNT_ID ?? ''
const POLL_MS = 1500

interface RawMsg {
  id: string
  channel_id: string
  sender_name: string
  sender_email: string
  body: string
  edited_at: string | null
  created_at: string
}

function toMsg(r: RawMsg) {
  return {
    id: r.id, channelId: r.channel_id, senderName: r.sender_name,
    senderEmail: r.sender_email, body: r.body,
    editedAt: r.edited_at, createdAt: r.created_at,
  }
}

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  let after = req.nextUrl.searchParams.get('after') ?? null

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const signal = req.signal
      let closed = false

      const enqueue = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk))
      }

      // Keepalive comment every 20s
      const keepalive = setInterval(() => {
        enqueue(': keepalive\n\n')
      }, 20_000)

      signal.addEventListener('abort', () => {
        closed = true
        clearInterval(keepalive)
        try { controller.close() } catch {}
      })

      const poll = async () => {
        if (closed) return
        try {
          const url = new URL(`${MAILSERVER_URL}/api/v1/channels/${id}/messages`)
          if (after) url.searchParams.set('after', after)
          const res = await fetch(url.toString(), {
            headers: {
              'X-API-Key': MAILSERVER_API_KEY,
              'X-Account-Id': MAILSERVER_ACCOUNT_ID,
            },
            signal: AbortSignal.timeout(4000),
          })
          if (res.ok) {
            const msgs = (await res.json()) as RawMsg[]
            if (msgs.length > 0) {
              after = msgs.at(-1)!.id
              for (const m of msgs) {
                enqueue(`data: ${JSON.stringify({ type: 'message:new', message: toMsg(m) })}\n\n`)
              }
            }
          }
        } catch { /* ignore timeouts / transient errors */ }

        if (!closed) setTimeout(poll, POLL_MS)
      }

      setTimeout(poll, POLL_MS)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
