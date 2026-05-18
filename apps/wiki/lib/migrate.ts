import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import postgres from 'postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = postgres(process.env.DATABASE_URL!)

console.log('Running wiki migrations…')
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
await sql.unsafe(schema)
console.log('Done.')
await sql.end()
