import { cleanupSessions, closeDb } from '@owl/e2e'

export default async function globalTeardown() {
  await cleanupSessions()
  await closeDb()
}
