// JMAP client — RFC 8620
// Connects to Stalwart Mail (or any JMAP-compliant server)

export interface JMAPSession {
  apiUrl: string
  downloadUrl: string
  uploadUrl: string
  capabilities: Record<string, unknown>
  accounts: Record<string, { name: string; isPersonalAccount: boolean }>
  primaryAccounts: Record<string, string>
}

export interface JMAPConfig {
  sessionUrl: string
  username: string
  password: string
}

export async function getSession(config: JMAPConfig): Promise<JMAPSession> {
  const res = await fetch(config.sessionUrl, {
    headers: {
      Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}`,
    },
  })
  if (!res.ok) throw new Error(`JMAP session failed: ${res.status}`)
  return res.json()
}

export async function jmapRequest(
  session: JMAPSession,
  config: JMAPConfig,
  calls: [string, Record<string, unknown>, string][]
): Promise<unknown[]> {
  const res = await fetch(session.apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail', 'urn:ietf:params:jmap:calendars'],
      methodCalls: calls,
    }),
  })
  if (!res.ok) throw new Error(`JMAP request failed: ${res.status}`)
  const data = await res.json()
  return data.methodResponses
}

export async function listThreads(
  session: JMAPSession,
  config: JMAPConfig,
  accountId: string,
  mailboxId: string
): Promise<unknown> {
  const responses = await jmapRequest(session, config, [
    ['Email/query', { accountId, filter: { inMailbox: mailboxId }, sort: [{ property: 'receivedAt', isAscending: false }], limit: 50 }, 'q'],
    ['Email/get', { accountId, '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' }, properties: ['id', 'threadId', 'subject', 'from', 'receivedAt', 'preview', 'unread'] }, 'g'],
  ])
  return responses
}
