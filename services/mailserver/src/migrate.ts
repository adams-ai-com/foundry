import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { sql } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const schema = readFileSync(resolve(__dirname, 'schema.sql'), 'utf-8')

async function migrate() {
  console.log('Running migrations...')
  await sql.unsafe(schema)
  console.log('Done.')
  await sql.end()
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
