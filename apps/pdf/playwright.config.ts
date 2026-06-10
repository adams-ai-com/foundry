import { defineConfig } from '@playwright/test'
import { readFileSync } from 'fs'
import path from 'path'

// Share apps/pdf/.env (DB URLs, proc secret) with the test process and the
// spawned test app instance. Process env always wins over .env values.
const envFile = readFileSync(path.join(__dirname, '.env'), 'utf8')
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
}

const MOCK_PORT = 3940
const APP_PORT = 3019

// The test app instance sends signing webhooks to the local mock, never to
// panel/Guardian — test runs must not produce real email or burn send caps.
const TEST_ENV = {
  SIGNING_EMAIL_WEBHOOK_URL: `http://127.0.0.1:${MOCK_PORT}/webhook`,
  PDF_SIGNING_WEBHOOK_SECRET: 'e2e-mock-secret',
}
Object.assign(process.env, TEST_ENV)

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/global-teardown.ts',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
  },
  webServer: [
    {
      command: 'node e2e/webhook-mock.mjs',
      port: MOCK_PORT,
      reuseExistingServer: true,
      cwd: __dirname,
    },
    {
      command: `./node_modules/.bin/next start --port ${APP_PORT} --hostname 127.0.0.1`,
      port: APP_PORT,
      reuseExistingServer: true,
      timeout: 60_000,
      cwd: __dirname,
      env: { ...(process.env as Record<string, string>), ...TEST_ENV },
    },
  ],
})
