import type { FastifyInstance } from 'fastify'
import { buildApi } from '../api/index.js'
import { sql } from '../db.js'

export interface TestAccount {
  id: string
  domain: string
}

export async function createTestAccount(suffix: string): Promise<TestAccount> {
  const id = `test-${suffix}-${Date.now()}`
  const domain = `${suffix}-${Date.now()}.test`
  await sql`
    INSERT INTO accounts (id, domain, display_name)
    VALUES (${id}, ${domain}, ${'Test ' + suffix})
  `
  return { id, domain }
}

export async function deleteTestAccount(id: string): Promise<void> {
  await sql`DELETE FROM accounts WHERE id = ${id}`
}

export async function makeApp(): Promise<FastifyInstance> {
  return buildApi()
}

export function authHeaders(accountId: string): Record<string, string> {
  return {
    'x-api-key': 'test-key',
    'x-account-id': accountId,
  }
}

export async function inject(
  app: FastifyInstance,
  method: string,
  url: string,
  opts: { accountId: string; body?: unknown; headers?: Record<string, string> },
) {
  const hasBody = opts.body !== undefined
  return app.inject({
    method: method as any,
    url,
    headers: {
      ...authHeaders(opts.accountId),
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      ...opts.headers,
    },
    payload: hasBody ? JSON.stringify(opts.body) : undefined,
  })
}
