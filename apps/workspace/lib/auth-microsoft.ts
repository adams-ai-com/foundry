import { createHash, randomBytes } from 'crypto'

const tenantId = () => process.env.ENTRA_TENANT_ID ?? ''
const clientId = () => process.env.ENTRA_CLIENT_ID ?? ''
const clientSecret = () => process.env.ENTRA_CLIENT_SECRET ?? ''
const redirectUri = () =>
  `${(process.env.APP_URL ?? 'https://foundry.adams-ai.com').replace(/\/$/, '')}/api/auth/microsoft/callback`

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export function buildAuthUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: 'code',
    redirect_uri: redirectUri(),
    response_mode: 'query',
    scope: 'openid profile email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/authorize?${params}`
}

export async function exchangeCode(
  code: string,
  codeVerifier: string,
): Promise<{ oid: string; email: string; name: string }> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    code,
    redirect_uri: redirectUri(),
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
    scope: 'openid profile email',
  })

  const resp = await fetch(
    `https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
  )
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Token exchange failed (${resp.status}): ${text}`)
  }

  const data = await resp.json() as { id_token: string }
  const parts = data.id_token.split('.')
  if (parts.length < 2) throw new Error('Invalid id_token format')

  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
    oid?: string
    email?: string
    preferred_username?: string
    unique_name?: string
    name?: string
  }

  const oid = payload.oid ?? ''
  const email = (payload.email ?? payload.preferred_username ?? payload.unique_name ?? '').toLowerCase()
  const name = payload.name ?? ''

  if (!oid || !email) throw new Error('Missing oid or email in token claims')
  return { oid, email, name }
}

export function isMsConfigured(): boolean {
  return !!(process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET)
}
