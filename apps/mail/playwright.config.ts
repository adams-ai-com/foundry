import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  outputDir: '/tmp/mail-test-results',
  fullyParallel: false,
  retries: 1,
  timeout: 30_000,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: process.env.MAIL_BASE_URL ?? 'http://localhost:3004/mail',
    trace: 'on-first-retry',
    storageState: './e2e/auth-state.json',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
