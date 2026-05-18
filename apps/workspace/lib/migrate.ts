import postgres from 'postgres'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function migrate() {
  const db = postgres(process.env.DATABASE_URL!)
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
  await db.unsafe(schema)
  await db.end()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate().then(() => { console.log('migration done'); process.exit(0) })
    .catch(e => { console.error(e); process.exit(1) })
}
