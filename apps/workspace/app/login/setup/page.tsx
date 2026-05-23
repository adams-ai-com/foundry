import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { startSetup, confirmTotpSetup } from '@/lib/actions'
import { generateQRDataURL } from '@/lib/totp'
import { AuthShell } from '@/components/AuthShell'
import { TotpForm } from '@/components/TotpForm'

export const dynamic = 'force-dynamic'

function Step({ n, label, active }: { n: number; label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 text-xs ${active ? 'text-fg-primary font-medium' : 'text-fg-tertiary'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
        active ? 'bg-accent text-accent-fg' : 'bg-bg-hover text-fg-tertiary'
      }`}>
        {n}
      </div>
      {label}
    </div>
  )
}

export default async function SetupPage() {
  const jar = await cookies()
  const email = jar.get('foundry_login_email')?.value
  if (!email) redirect('/login')
  const pending = jar.get('foundry_totp_pending')?.value

  if (!pending) {
    return (
      <AuthShell>
        <div>
          <div className="mb-7">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 mb-5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
                   strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-accent">
                <path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-fg-primary tracking-tight mb-2">
              Set up two-factor authentication
            </h1>
            <p className="text-sm text-fg-secondary leading-relaxed">
              Protect your account with a time-based one-time password from your phone.
            </p>
          </div>

          <div className="bg-bg-surface border border-border rounded-2xl p-5 mb-6 space-y-3">
            <Step n={1} label="Install Microsoft Authenticator on your phone" active={true} />
            <Step n={2} label="Generate your QR code" active={false} />
            <Step n={3} label="Scan and confirm" active={false} />
          </div>

          <form action={startSetup}>
            <button
              type="submit"
              className="w-full bg-accent hover:bg-accent-hover text-accent-fg font-semibold py-3 rounded-xl text-sm transition-all duration-150 flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                   strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
                <path d="M14 14h3v3m0 0h3m-3 0v3"/>
              </svg>
              Generate QR code
            </button>
          </form>

          <div className="mt-4 text-center">
            <a href="/login" className="text-xs text-fg-tertiary hover:text-fg-secondary transition-colors">
              ← Back to login
            </a>
          </div>
        </div>
      </AuthShell>
    )
  }

  const qrDataUrl = await generateQRDataURL(email, pending)

  return (
    <AuthShell>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-fg-primary tracking-tight mb-2">
            Scan with Authenticator
          </h1>
          <p className="text-sm text-fg-secondary leading-relaxed">
            Open <span className="font-medium text-fg-primary">Microsoft Authenticator</span> →
            tap <span className="font-medium text-fg-primary">+</span> →
            tap <span className="font-medium text-fg-primary">Other account</span> → scan the code.
          </p>
        </div>

        {/* QR Code frame */}
        <div className="flex justify-center mb-6">
          <div className="relative p-3 bg-white rounded-2xl shadow-[0_2px_24px_rgb(0_0_0/.12)] border border-black/[.04]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="TOTP QR code"
              className="w-44 h-44 block rounded-lg"
            />
            {/* Corner accents */}
            <div className="absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-accent rounded-tl" />
            <div className="absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-accent rounded-tr" />
            <div className="absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-accent rounded-bl" />
            <div className="absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-accent rounded-br" />
          </div>
        </div>

        <p className="text-xs text-fg-tertiary text-center mb-5 leading-relaxed">
          After scanning, enter the 6-digit code shown in the app to confirm.
        </p>

        <TotpForm action={confirmTotpSetup} buttonLabel="Confirm & sign in" />

        <div className="mt-4 text-center">
          <a href="/login" className="text-xs text-fg-tertiary hover:text-fg-secondary transition-colors">
            ← Start over
          </a>
        </div>
      </div>
    </AuthShell>
  )
}
