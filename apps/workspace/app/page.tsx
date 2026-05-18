import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function RootPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  // If session has an org, go there; otherwise find the user's first org
  if (session.orgId) redirect(`/org/${await getOrgSlug(session.orgId)}`)

  const memberRows = await db`
    SELECT o.slug FROM orgs o
    JOIN org_members m ON m.org_id = o.id
    WHERE m.user_id = ${session.userId}
    ORDER BY m.joined_at ASC LIMIT 1
  `
  if (memberRows.length) redirect(`/org/${memberRows[0].slug}`)

  redirect('/new-org')
}

async function getOrgSlug(orgId: string): Promise<string> {
  const rows = await db`SELECT slug FROM orgs WHERE id = ${orgId}`
  return rows[0]?.slug ?? ''
}
