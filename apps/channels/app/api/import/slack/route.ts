import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import db from '@/lib/db'
import { parseSlackZip } from '@/lib/slack-importer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const jobs = await db`
    SELECT id, status, filename, slack_workspace_name, messages_imported, messages_total,
           users_unmatched, attachments_unavailable, error_message, started_at, completed_at, created_at
    FROM slack_import_jobs WHERE org_id = ${session.orgId} ORDER BY created_at DESC LIMIT 20
  `
  return NextResponse.json(jobs)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  if (!file.name.endsWith('.zip')) return NextResponse.json({ error: 'Must be a .zip file' }, { status: 400 })

  const jobId = randomUUID()
  const zipPath = join(tmpdir(), `slack-import-${jobId}.zip`)
  const bytes = await file.arrayBuffer()
  writeFileSync(zipPath, Buffer.from(bytes))

  let parsed
  try {
    parsed = parseSlackZip(zipPath)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 })
  }

  // Auto-match Slack users by email against existing channel_messages authors
  const existingAuthors = await db`
    SELECT DISTINCT author_id, author_email FROM channel_messages WHERE org_id = ${session.orgId}
  ` as { author_id: string; author_email: string }[]
  const emailToId = new Map(existingAuthors.map(a => [a.author_email.toLowerCase(), a.author_id]))

  const userMapping: Record<string, string> = {}
  let autoMatched = 0
  for (const u of parsed.users) {
    if (u.email && emailToId.has(u.email.toLowerCase())) {
      userMapping[u.id] = emailToId.get(u.email.toLowerCase())!
      autoMatched++
    }
  }

  // Default channel mapping: create new for each
  const channelMapping: Record<string, { foundry_channel_id: string | null; create_new: boolean; new_name: string | null; skip: boolean }> = {}
  for (const c of parsed.channels) {
    channelMapping[c.id] = { foundry_channel_id: null, create_new: !c.is_dm, new_name: c.name, skip: c.is_dm }
  }

  await db`
    INSERT INTO slack_import_jobs
      (id, org_id, created_by, status, filename, zip_path, slack_workspace_name,
       user_mapping, channel_mapping, slack_users, slack_channels)
    VALUES
      (${jobId}, ${session.orgId}, ${session.userId}, 'pending', ${file.name}, ${zipPath},
       ${parsed.workspace_name}, ${JSON.stringify(userMapping)}, ${JSON.stringify(channelMapping)},
       ${JSON.stringify(parsed.users)}, ${JSON.stringify(parsed.channels)})
  `

  // Get existing OWL channels for mapping UI
  const foundryChannels = await db`
    SELECT id, name FROM channels WHERE org_id = ${session.orgId} AND is_archived = false AND type = 'stream'
    ORDER BY name ASC
  `

  return NextResponse.json({
    jobId,
    workspace_name: parsed.workspace_name,
    users: parsed.users,
    channels: parsed.channels,
    user_mapping: userMapping,
    channel_mapping: channelMapping,
    auto_matched: autoMatched,
    owl_channels: foundryChannels,
  }, { status: 201 })
}
