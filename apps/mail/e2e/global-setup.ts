// Verifies the mail client and mailserver are reachable before running E2E tests.
// Does not mutate any state — test suites manage their own DB fixtures via the API.
export default async function globalSetup() {
  const base = process.env.MAIL_BASE_URL ?? 'http://localhost:3004/mail'
  const mailserverUrl = process.env.MAILSERVER_HEALTH_URL ?? 'http://localhost:3100/health'

  const clientRes = await fetch(base, {
    headers: { Cookie: 'foundry_session=e2e-test-session-fixed' },
  }).catch(() => null)
  if (!clientRes || !clientRes.ok) {
    throw new Error(
      `Mail client at ${base} is not reachable. Start it with: pnpm --filter @foundry/mail dev`,
    )
  }

  const serverRes = await fetch(mailserverUrl).catch(() => null)
  if (!serverRes || !serverRes.ok) {
    throw new Error(
      `Mailserver health check at ${mailserverUrl} failed. Start it with: pnpm --filter @foundry/mailserver dev`,
    )
  }

  console.log(`✓ Mail client: ${base}`)
  console.log(`✓ Mailserver: ${mailserverUrl}`)
}
