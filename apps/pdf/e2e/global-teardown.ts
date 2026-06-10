import { cleanupTestData, pdfDb, wsDb } from './helpers'

export default async function globalTeardown() {
  await cleanupTestData()
  await pdfDb.end()
  await wsDb.end()
}
