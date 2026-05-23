import { createHmac, randomUUID } from 'node:crypto'

const GUARDIAN_URL = process.env.GUARDIAN_URL ?? 'http://10.0.0.2:3001'
const TIMEOUT_MS = 5 * 60 * 1000

function sign(body: string, secret: string): string {
  const ts = Math.floor(Date.now() / 1000).toString()
  const hex = createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex')
  return `${ts}:${hex}`
}

export function isGuardianConfigured(): boolean {
  return !!process.env.GUARDIAN_SHARED_SECRET
}

export async function callGuardianTool(action: string, params: Record<string, unknown>): Promise<unknown> {
  const secret = process.env.GUARDIAN_SHARED_SECRET
  if (!secret) throw new Error('GUARDIAN_SHARED_SECRET not configured')

  const body = JSON.stringify({
    id: `foundry-channels-${randomUUID()}`,
    scope: 'personal',
    source: 'foundry-channels',
    action,
    params,
  })

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(GUARDIAN_URL + '/api/v1/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Guardian-Signature': sign(body, secret),
      },
      body,
      signal: ctrl.signal,
    })
    const parsed = await res.json() as { status: string; message?: string; result?: unknown }
    if (parsed.status !== 'executed' || parsed.result === undefined) {
      throw new Error(`Guardian ${action} ${parsed.status}: ${parsed.message ?? ''}`)
    }
    return parsed.result
  } finally {
    clearTimeout(timer)
  }
}
