import { sql, newId } from '../db.js'

// Strip Re:, Fwd:, Aw:, and variants to get the base subject for matching
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd?|aw|antwort|sv|vs|ref)(\[\d+\])?\s*:\s*/gi, '')
    .trim()
    .toLowerCase()
}

// Parse References header into an array of Message-IDs
function parseReferences(refs: string | null | undefined): string[] {
  if (!refs) return []
  return refs.match(/<[^>]+>/g) ?? []
}

// Find or create a thread for an incoming message
export async function resolveThread(accountId: string, msg: {
  messageId: string | null
  inReplyTo: string | null
  references: string | null
  subject: string
  fromEmail: string
  fromName: string | null
  toAddrs: { name?: string; email: string }[]
  date: Date
}): Promise<string> {
  const normalized = normalizeSubject(msg.subject)

  // 1. Check by In-Reply-To — most reliable signal
  if (msg.inReplyTo) {
    const parent = await sql<{ thread_id: string }[]>`
      SELECT thread_id FROM messages
      WHERE account_id = ${accountId}
        AND message_id = ${msg.inReplyTo}
        AND thread_id IS NOT NULL
      LIMIT 1
    `
    if (parent.length > 0) return parent[0].thread_id
  }

  // 2. Check References chain — walk from most recent to oldest
  const refs = parseReferences(msg.references)
  if (refs.length > 0) {
    const found = await sql<{ thread_id: string }[]>`
      SELECT thread_id FROM messages
      WHERE account_id = ${accountId}
        AND message_id = ANY(${refs})
        AND thread_id IS NOT NULL
      ORDER BY received_at DESC
      LIMIT 1
    `
    if (found.length > 0) return found[0].thread_id
  }

  // 3. Subject match within 7 days — fallback for poorly-threaded clients
  if (normalized) {
    const cutoff = new Date(msg.date.getTime() - 7 * 24 * 60 * 60 * 1000)
    const bySubject = await sql<{ id: string }[]>`
      SELECT id FROM threads
      WHERE account_id = ${accountId}
        AND normalized_subject = ${normalized}
        AND last_message_at > ${cutoff}
      ORDER BY last_message_at DESC
      LIMIT 1
    `
    if (bySubject.length > 0) return bySubject[0].id
  }

  // 4. Create a new thread
  const threadId = newId()
  const participants = [
    { name: msg.fromName ?? undefined, email: msg.fromEmail },
    ...msg.toAddrs,
  ]

  await sql`
    INSERT INTO threads (id, account_id, subject, normalized_subject, participants, last_message_at, snippet)
    VALUES (
      ${threadId}, ${accountId}, ${msg.subject}, ${normalized},
      ${JSON.stringify(participants)}, ${msg.date}, ''
    )
  `
  return threadId
}

// Update thread metadata after a message is stored
export async function updateThreadMeta(threadId: string, accountId: string) {
  const stats = await sql<{ count: number; unread: number; last: Date; snippet: string; from_name: string | null; from_email: string }[]>`
    SELECT
      COUNT(*)::int AS count,
      COUNT(*) FILTER (WHERE NOT is_read AND NOT is_draft)::int AS unread,
      MAX(date) AS last,
      (SELECT body_text FROM messages
       WHERE thread_id = ${threadId} ORDER BY date DESC LIMIT 1) AS snippet,
      (SELECT from_email FROM messages
       WHERE thread_id = ${threadId} ORDER BY date DESC LIMIT 1) AS from_email,
      (SELECT from_name FROM messages
       WHERE thread_id = ${threadId} ORDER BY date DESC LIMIT 1) AS from_name
    FROM messages
    WHERE thread_id = ${threadId} AND account_id = ${accountId}
  `

  if (!stats.length) return

  const { count, unread, last, snippet, from_email, from_name } = stats[0]

  // Gather all unique participants
  const participants = await sql<{ from_email: string; from_name: string | null; to_addrs: { email: string; name?: string }[] }[]>`
    SELECT from_email, from_name, to_addrs FROM messages
    WHERE thread_id = ${threadId}
  `
  const seen = new Map<string, string | null>()
  for (const m of participants) {
    seen.set(m.from_email, m.from_name)
    for (const a of m.to_addrs as { email: string; name?: string }[]) {
      if (!seen.has(a.email)) seen.set(a.email, a.name ?? null)
    }
  }
  const allParticipants = Array.from(seen.entries()).map(([email, name]) => ({ email, name }))

  const snippetText = snippet ? snippet.slice(0, 200).replace(/\s+/g, ' ').trim() : ''

  await sql`
    UPDATE threads SET
      message_count = ${count},
      unread_count  = ${unread},
      last_message_at = ${last},
      snippet = ${snippetText},
      participants = ${JSON.stringify(allParticipants)}
    WHERE id = ${threadId}
  `
}
