import db from './db'

export async function writeAudit(params: {
  orgId: string | null
  actorId?: string | null
  actorEmail: string
  action: string
  targetId?: string | null
  targetEmail?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await db`
      INSERT INTO audit_log
        (org_id, actor_id, actor_email, action, target_id, target_email, metadata)
      VALUES (
        ${params.orgId},
        ${params.actorId ?? null},
        ${params.actorEmail},
        ${params.action},
        ${params.targetId ?? null},
        ${params.targetEmail ?? null},
        ${JSON.stringify(params.metadata ?? {})}::jsonb
      )
    `
  } catch {
    // Audit write must never block the caller
  }
}
