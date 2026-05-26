import { SigningClient } from './SigningClient'

interface Props { params: Promise<{ token: string }> }

export const dynamic = 'force-dynamic'

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
    return (
      <InfoPage
        title={data.title ?? 'Document'}
        heading="Document complete"
        body="All signatures have been collected. This envelope is closed."
      />
    )
  }

  if (data?.error === 'already_signed') {
    return (
      <InfoPage
        title="Signing request"
        heading="Already signed"
        body="You have already signed this document. Thank you."
      />
    )
  }

  if (data?.error === 'not_your_turn') {
    return (
      <InfoPage
        title={data.title ?? 'Document'}
        heading="Waiting for a previous signer"
        body="You will receive a new signing link once earlier signers have completed their review."
      />
    )
  }

  if (data?.error === 'Envelope voided') {
    return <InfoPage title="Signing request" heading="Voided" body="This envelope has been cancelled." />
  }

  return (
    <SigningClient
      token={token}
      initialData={data}
      branding={data?.branding ?? null}
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

function InfoPage({ title, heading, body }: { title: string; heading: string; body: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-4">
        <div className="text-4xl mb-4">✅</div>
        <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">{title}</p>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">{heading}</h1>
        <p className="text-sm text-gray-500">{body}</p>
        <p className="text-xs text-gray-400 mt-8">Powered by Foundry PDF · Open source</p>
      </div>
    </div>
  )
}
