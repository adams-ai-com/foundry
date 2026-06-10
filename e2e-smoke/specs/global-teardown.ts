import { cleanupSessions, closeDb } from '@foundry/e2e'

export default async function globalTeardown() {
  await cleanupSessions()
  await closeDb()
}
