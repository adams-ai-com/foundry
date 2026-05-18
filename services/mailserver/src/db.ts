import postgres from 'postgres'
import { config } from './config.js'

export const sql = postgres(config.db)

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20)
}
