import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { startSetup, confirmTotpSetup } from '@/lib/actions'
import { generateQRDataURL } from '@/lib/totp'
import { TotpForm } from '@/components/TotpForm'

export const dynamic = 'force-dynamic'

function Header() {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
        <span className="text-white font-bold text-xl">F</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Foundry</h1>
      <p className="text-gray-500 text-sm mt-1">Open-source workspace</p>
    </div>
  )
}

export default async function SetupPage() {
  const jar = await cookies()
  const email = jar.get('foundry_login_email')?.value
  if (!email) redirect('/login')

  const pendingSecret = jar.get('foundry_totp_pending')?.value

  if (!pendingSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <Header />
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Set up Authenticator</h2>
            <p className="text-gray-500 text-sm mb-6">
              You&apos;ll need <strong>Microsoft Authenticator</strong> installed on your phone.
              Click below to generate your QR code.
            </p>
            <form action={startSetup}>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                Generate QR code →
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  const qrDataUrl = await generateQRDataURL(email, pendingSecret)

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Header />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Scan QR code</h2>
          <p className="text-gray-500 text-sm mb-4">
            Open <strong>Microsoft Authenticator</strong> → <em>+</em> → <em>Other account</em> → scan this code.
          </p>
          <div className="flex justify-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="TOTP setup QR code" className="w-48 h-48 rounded-xl border border-gray-100" />
          </div>
          <p className="text-gray-500 text-sm mb-4">Then enter the 6-digit code to confirm.</p>
          <TotpForm action={confirmTotpSetup} buttonLabel="Confirm & sign in" />
        </div>
      </div>
    </div>
  )
}
