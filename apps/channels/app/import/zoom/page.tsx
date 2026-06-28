import { requireSession } from '@owl/auth'
import db from '@/lib/db'
import { ZoomImportWizard } from '@/components/ZoomImportWizard'

export const dynamic = 'force-dynamic'

export default async function ZoomImportPage() {
  const session = await requireSession()

  const foundryChannels = await db`
    SELECT id, name FROM channels
    WHERE org_id = ${session.orgId!} AND is_archived = false AND type = 'stream'
    ORDER BY name ASC
  ` as { id: string; name: string }[]

  const recentJobs = await db`
    SELECT id, status, total, processed, error_message, created_at
    FROM zoom_import_jobs
    WHERE org_id = ${session.orgId!}
    ORDER BY created_at DESC LIMIT 5
  ` as {
    id: string; status: string; total: number; processed: number
    error_message: string | null; created_at: string
  }[]

  return <ZoomImportWizard foundryChannels={foundryChannels} recentJobs={recentJobs} />
}
