import { createHmac, timingSafeEqual, randomBytes } from 'crypto'

function secret(): string {
  const s = process.env.SIGNING_TOKEN_SECRET
  if (!s) throw new Error('SIGNING_TOKEN_SECRET not configured')
  return s
}

export interface TokenPayload {
  r: string   // recipient_id
  e: string   // envelope_id
  exp: number // Unix seconds
}

export function generateToken(payload: TokenPayload): string {
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret()).update(json).digest('base64url')
  return `${json}.${sig}`
}

/** Returns the payload if valid, null if tampered / expired / malformed. */
export function verifyToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  const json = token.slice(0, dot)
  const sig  = token.slice(dot + 1)
  const expected = createHmac('sha256', secret()).update(json).digest('base64url')
  try {
    const a = Buffer.from(sig, 'base64url')
    const b = Buffer.from(expected, 'base64url')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch { return null }
  try {
    const payload = JSON.parse(Buffer.from(json, 'base64url').toString()) as TokenPayload
    if (typeof payload.r !== 'string' || typeof payload.e !== 'string') return null
    if (payload.exp < Date.now() / 1000) return null  // expired
    return payload
  } catch { return null }
}

export function generateExpiryTimestamp(days: number): number {
  return Math.floor(Date.now() / 1000) + days * 86400
}

export function randomHex(bytes = 16): string {
  return randomBytes(bytes).toString('hex')
}
