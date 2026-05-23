import db from './db'

export async function getOrgTimezone(orgId: string): Promise<string> {
  const rows = await db`SELECT timezone FROM orgs WHERE id = ${orgId}`
  return (rows[0]?.timezone as string) ?? 'UTC'
}

export function fmtDateTz(ts: string | null, tz: string): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: tz,
  })
}

export function fmtDateTimeTz(ts: string, tz: string): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: tz,
  })
}
