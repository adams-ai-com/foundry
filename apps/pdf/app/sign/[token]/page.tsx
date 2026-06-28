import { getSession, type SessionUser } from '@owl/auth'
import postgres from 'postgres'
import { SigningClient } from './SigningClient'

interface Props { params: Promise<{ token: string }> }

export const dynamic = 'force-dynamic'

// Module-level workspace DB connection for OWL user detection
let _wsDb: ReturnType<typeof postgres> | null = null
function wsDb() {
  if (!_wsDb) {
    const url = process.env.WORKSPACE_DATABASE_URL ?? process.env.DATABASE_URL
    if (url) _wsDb = postgres(url, { max: 2 })
  }
  return _wsDb
}

export default async function SignPage({ params }: Props) {
  const { token } = await params

  // Fetch signing data server-side — passes initial state to client
  const base = process.env.SIGNING_BASE_URL ?? 'https://foundry.adams-ai.com'
  let data: any = null
  let fetchError: string | null = null

  try {
    const res = await fetch(`${base}/pdf/api/sign/${token}`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    })
    data = await res.json()
  } catch {
    fetchError = 'Unable to load this signing request.'
  }

  // Handle terminal states server-side for clean SSR
  if (fetchError || data?.error === 'Invalid or expired link') {
    return <ErrorPage message={fetchError ?? 'This signing link is invalid or has expired.'} />
  }
  if (data?.error === 'already_complete') {
    return <InfoPage title={data.title ?? 'Document'} heading="Document complete"
      body="All signatures have been collected. This envelope is closed." />
  }
  if (data?.error === 'already_signed') {
    return <InfoPage title="Signing request" heading="Already signed"
      body="You have already signed this document. Thank you." />
  }
  if (data?.error === 'not_your_turn') {
    return <InfoPage title={data.title ?? 'Document'} heading="Waiting for a previous signer"
      body="You will receive a new signing link once earlier signers have completed their review." />
  }
  if (data?.error === 'already_declined') {
    return <InfoPage title={data.title ?? 'Signing request'} heading="Signing declined"
      body="You have declined to sign this document. The sender has been notified." icon="✗" />
  }
  if (data?.error === 'Envelope voided') {
    return <InfoPage title="Signing request" heading="Voided" body="This envelope has been cancelled." />
  }

  // ── OWL Workspace Identity detection ─────────────────────────────────────

  const recipientEmail: string = data?.recipient_email ?? ''
  let owlUser: SessionUser | null = null
  let isOWLUser = false

  try {
    const session = await getSession()
    if (session && recipientEmail &&
        session.email.toLowerCase() === recipientEmail.toLowerCase()) {
      owlUser = session
      isOWLUser = true
    }
  } catch { /* non-fatal — external signer path */ }

  // If not currently signed in, check whether this recipient is an OWL user at all
  if (!owlUser && recipientEmail) {
    try {
      const db = wsDb()
      if (db) {
        const rows = await db`SELECT id FROM users WHERE email = ${recipientEmail} LIMIT 1`
        isOWLUser = rows.length > 0
      }
    } catch { /* non-fatal */ }
  }

  // OWL user but not signed in → gate with login prompt
  if (isOWLUser && !owlUser) {
    const wsBase = process.env.FOUNDRY_WORKSPACE_URL ?? 'https://foundry.adams-ai.com'
    const loginUrl = `${wsBase}/login`
    const signingUrl = `${base}/pdf/sign/${token}`
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-6">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Sign with your OWL account</h1>
          <p className="text-sm text-gray-500 mb-1">
            <strong>{data?.title}</strong>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            This signing request is addressed to <strong>{recipientEmail}</strong>.
            Sign in to your OpenWork Loft account to continue.
          </p>
          <a
            href={loginUrl}
            className="inline-block bg-blue-600 text-white text-sm font-semibold px-6 py-3 rounded-xl
                       hover:bg-blue-700 transition-colors"
          >
            Sign in to OpenWork Loft →
          </a>
          <p className="text-xs text-gray-400 mt-4">
            After signing in, return to this link:
          </p>
          <p className="text-xs text-gray-400 font-mono break-all mt-1">{signingUrl}</p>
          <p className="text-xs text-gray-300 mt-8">Powered by OWL PDF · Open source</p>
        </div>
      </div>
    )
  }

  const owlUserProp = owlUser
    ? { userId: owlUser.userId, email: owlUser.email, name: owlUser.name }
    : null

  return (
    <SigningClient
      token={token}
      initialData={data}
      branding={data?.branding ?? null}
      owlUser={owlUserProp}
    />
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-4">
        <div className="text-4xl mb-4">🔗</div>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Link unavailable</h1>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  )
}

function InfoPage({ title, heading, body, icon = '✅' }: { title: string; heading: string; body: string; icon?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-4">
        <div className="text-4xl mb-4">{icon}</div>
        <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">{title}</p>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">{heading}</h1>
        <p className="text-sm text-gray-500">{body}</p>
        <p className="text-xs text-gray-400 mt-8">Powered by OWL PDF · Open source</p>
      </div>
    </div>
  )
}
