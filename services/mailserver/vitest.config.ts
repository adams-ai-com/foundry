import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      API_KEY: 'test-key',
      API_PORT: '0',
      SMTP_PORT: '0',
      NODE_ENV: 'test',
    },
    include: ['src/__tests__/**/*.test.ts'],
    reporters: ['verbose'],
  },
})
