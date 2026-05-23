import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await requireAdmin()
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const cat = searchParams.get('cat') ?? ''

  const rows = await db`
    SELECT actor_email, action, target_email, metadata, created_at
    FROM audit_log
    WHERE org_id = ${session.orgId!}
      ${cat ? db`AND action LIKE ${cat + '.%'}` : db``}
      ${q ? db`AND (actor_email ILIKE ${'%' + q + '%'} OR target_email ILIKE ${'%' + q + '%'} OR action ILIKE ${'%' + q + '%'})` : db``}
    ORDER BY created_at DESC
    LIMIT 10000
  ` as unknown as Array<{
    actor_email: string
    action: string
    target_email: string | null
    metadata: Record<string, unknown>
    created_at: string
  }>

  function csvCell(v: unknown): string {
    return `"${String(v ?? '').replace(/"/g, '""')}"`
  }

  const lines = [
    'time,actor,action,target,details',
    ...rows.map(r => [
      new Date(r.created_at).toISOString(),
      r.actor_email,
      r.action,
      r.target_email ?? '',
      JSON.stringify(r.metadata ?? {}),
    ].map(csvCell).join(',')),
  ]

  const date = new Date().toISOString().slice(0, 10)
  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-log-${date}.csv"`,
    },
  })
}
