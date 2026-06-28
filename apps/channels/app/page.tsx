import { redirect } from 'next/navigation'
import { getSession } from '@owl/auth'

export const dynamic = 'force-dynamic'

export default async function RootPage() {
  const session = await getSession()
  if (!session) {
    const base = process.env.FOUNDRY_WORKSPACE_URL ?? ''
    redirect(`${base}/login`)
  }
  if (!session.orgSlug) redirect('/new-org')
  redirect(`/org/${session.orgSlug}`)
}
