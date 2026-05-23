import { requireSession } from '@foundry/auth'
import db from '@/lib/db'
import { GChatImportWizard } from '@/components/GChatImportWizard'

export const dynamic = 'force-dynamic'

export default async function GChatImportPage() {
  const session = await requireSession()

  const foundryChannels = await db`
    SELECT id, name FROM channels
    WHERE org_id = ${session.orgId!} AND is_archived = false AND type = 'stream'
    ORDER BY name ASC
  ` as { id: string; name: string }[]

  const recentJobs = await db`
    SELECT id, status, filename, messages_imported, users_unmatched, completed_at, created_at
    FROM google_chat_import_jobs
    WHERE org_id = ${session.orgId!}
    ORDER BY created_at DESC LIMIT 5
  ` as {
    id: string; status: string; filename: string | null
    messages_imported: number; users_unmatched: number
    completed_at: string | null; created_at: string
  }[]

  return <GChatImportWizard foundryChannels={foundryChannels} recentJobs={recentJobs} />
}
