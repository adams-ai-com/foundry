import { sql as db, newId } from '../db.js'

export interface Decision {
  id: string
  accountId: string
  workspaceId: string | null
  subject: string
  outcome: string
  decidedBy: string | null
  decidedAt: Date
  sourceThreadId: string | null
  sourceMeetingId: string | null
  createdAt: Date
}

export async function listDecisions(
  accountId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ decisions: Decision[]; total: number }> {
  const { limit = 50, offset = 0 } = opts

  const [{ count }] = await db<{ count: string }[]>`
    SELECT COUNT(*) FROM decisions WHERE account_id = ${accountId}`

  const rows = await db<Decision[]>`
    SELECT id, account_id, workspace_id, subject, outcome, decided_by,
           decided_at, source_thread_id, source_meeting_id, created_at
    FROM decisions
    WHERE account_id = ${accountId}
    ORDER BY decided_at DESC
    LIMIT ${limit} OFFSET ${offset}`

  return { decisions: rows, total: Number(count) }
}

export async function getDecision(accountId: string, id: string): Promise<Decision | null> {
  const [row] = await db<Decision[]>`
    SELECT * FROM decisions WHERE id = ${id} AND account_id = ${accountId}`
  return row ?? null
}

export async function createDecision(
  accountId: string,
  input: {
    subject: string
    outcome: string
    decidedBy?: string
    decidedAt?: string
    sourceThreadId?: string
    sourceMeetingId?: string
    workspaceId?: string
  },
): Promise<Decision> {
  const id = newId()
  const [row] = await db<Decision[]>`
    INSERT INTO decisions (id, account_id, workspace_id, subject, outcome,
                           decided_by, decided_at, source_thread_id, source_meeting_id)
    VALUES (
      ${id}, ${accountId}, ${input.workspaceId ?? null},
      ${input.subject}, ${input.outcome},
      ${input.decidedBy ?? null}, ${input.decidedAt ?? db`NOW()`},
      ${input.sourceThreadId ?? null}, ${input.sourceMeetingId ?? null}
    )
    RETURNING *`
  return row
}

export async function updateDecision(
  accountId: string,
  id: string,
  patch: Partial<Pick<Decision, 'subject' | 'outcome' | 'decidedBy' | 'decidedAt'>>,
): Promise<Decision | null> {
  const [row] = await db<Decision[]>`
    UPDATE decisions SET
      subject     = COALESCE(${patch.subject ?? null}, subject),
      outcome     = COALESCE(${patch.outcome ?? null}, outcome),
      decided_by  = COALESCE(${patch.decidedBy ?? null}, decided_by),
      decided_at  = COALESCE(${patch.decidedAt ?? null}, decided_at)
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *`
  return row ?? null
}

export async function deleteDecision(accountId: string, id: string): Promise<boolean> {
  const result = await db`DELETE FROM decisions WHERE id = ${id} AND account_id = ${accountId}`
  return result.count > 0
}
