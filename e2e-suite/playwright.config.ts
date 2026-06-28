import { defineConfig } from '@playwright/test'
import path from 'path'
import { loadEnvFile } from '@owl/e2e'

// Smoke runs against the LIVE services on localhost — no extra app instances.
// Auth comes from a minted workspace session; nothing here sends email or
// touches paths with side effects beyond [E2E]-prefixed rows.
loadEnvFile(path.join(__dirname, '../apps/workspace/.env'))

export default defineConfig({
  testDir: './specs',
  globalTeardown: './specs/global-teardown.ts',
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
})
