import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import db from '@/lib/db'
import { parseTeamsZip } from '@/lib/teams-importer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const jobs = await db`
    SELECT id, status, filename, messages_imported, users_unmatched,
           attachments_unavailable, error_message, completed_at, created_at
    FROM teams_import_jobs WHERE org_id = ${session.orgId} ORDER BY created_at DESC LIMIT 20
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
  const zipPath = join(tmpdir(), `teams-import-${jobId}.zip`)
  writeFileSync(zipPath, Buffer.from(await file.arrayBuffer()))

  let parsed
  try {
    parsed = parseTeamsZip(zipPath)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 })
  }

  if (parsed.channels.length === 0) {
    return NextResponse.json({ error: 'No channels found in export. Ensure this is a Teams admin export ZIP.' }, { status: 422 })
  }

  // Auto-match Teams users by display name against existing channel_messages authors
  const existingAuthors = await db`
    SELECT DISTINCT author_id, author_name, author_email FROM channel_messages WHERE org_id = ${session.orgId}
  ` as { author_id: string; author_name: string; author_email: string }[]
  const nameToId = new Map(existingAuthors.map(a => [a.author_name.toLowerCase(), a.author_id]))

  const userMapping: Record<string, string> = {}
  let autoMatched = 0
  for (const u of parsed.users) {
    const match = nameToId.get(u.displayName.toLowerCase())
    if (match) { userMapping[u.id] = match; autoMatched++ }
  }

  // Default channel mapping
  const channelMapping: Record<string, { team_name: string; channel_name: string; foundry_channel_id: string | null; create_new: boolean; new_name: string | null; skip: boolean }> = {}
  for (const c of parsed.channels) {
    channelMapping[c.channelId] = {
      team_name: c.teamName, channel_name: c.channelName,
      foundry_channel_id: null, create_new: true, new_name: c.channelName, skip: false,
    }
  }

  await db`
    INSERT INTO teams_import_jobs
      (id, org_id, created_by, status, filename, zip_path,
       user_mapping, channel_mapping, teams_channels)
    VALUES
      (${jobId}, ${session.orgId}, ${session.userId}, 'pending', ${file.name}, ${zipPath},
       ${JSON.stringify(userMapping)}, ${JSON.stringify(channelMapping)},
       ${JSON.stringify(parsed.channels)})
  `

  const foundryChannels = await db`
    SELECT id, name FROM channels WHERE org_id = ${session.orgId} AND is_archived = false AND type = 'stream'
    ORDER BY name ASC
  `

  return NextResponse.json({
    jobId,
    users: parsed.users,
    channels: parsed.channels,
    user_mapping: userMapping,
    channel_mapping: channelMapping,
    auto_matched: autoMatched,
    foundry_channels: foundryChannels,
  }, { status: 201 })
}
