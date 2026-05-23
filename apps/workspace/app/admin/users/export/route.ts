import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireAdmin()

  const rows = await db`
    SELECT
      u.email,
      COALESCE(u.name, '') AS name,
      COALESCE(m.role, 'no org') AS role,
      CASE WHEN u.deactivated_at IS NOT NULL THEN 'deactivated' ELSE 'active' END AS status,
      (u.totp_secret IS NOT NULL)::text AS totp_enrolled,
      COALESCE(TO_CHAR(m.joined_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), '') AS joined_at,
      COALESCE(TO_CHAR(MAX(s.created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD'), '') AS last_sign_in,
      COUNT(CASE WHEN s.expires_at > NOW() THEN 1 END)::int AS active_sessions
    FROM users u
    LEFT JOIN org_members m ON m.user_id = u.id AND m.org_id = ${session.orgId!}
    LEFT JOIN sessions s ON s.user_id = u.id
    GROUP BY u.id, u.email, u.name, m.role, u.deactivated_at, u.totp_secret, m.joined_at
    ORDER BY m.joined_at DESC NULLS LAST, u.created_at DESC
  `

  const header = ['email', 'name', 'role', 'status', 'totp_enrolled', 'joined_at', 'last_sign_in', 'active_sessions']
  const escape = (v: unknown) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const lines = [
    header.join(','),
    ...(rows as unknown as Record<string, unknown>[]).map(row =>
      header.map(h => escape(row[h])).join(',')
    ),
  ]

  const csv = lines.join('\n')
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="foundry-users-${date}.csv"`,
    },
  })
}
