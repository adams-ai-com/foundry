import postgres from 'postgres'
import * as dotenv from 'dotenv'
import * as path from 'path'

export default async function globalSetup() {
  dotenv.config({ path: path.join(__dirname, '../.env') })
  const sql = postgres(process.env.DATABASE_URL!)
  await sql`DELETE FROM documents`
  await sql.end()
}
