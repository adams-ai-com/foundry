import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import db from '@/lib/db'
import { parseGoogleChatZip } from '@/lib/google-chat-importer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const jobs = await db`
    SELECT id, status, filename, messages_imported, users_unmatched, completed_at, created_at
    FROM google_chat_import_jobs WHERE org_id = ${session.orgId} ORDER BY created_at DESC LIMIT 20
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
  const zipPath = join(tmpdir(), `gchat-import-${jobId}.zip`)
  const bytes = await file.arrayBuffer()
  writeFileSync(zipPath, Buffer.from(bytes))

  let parsed
  try {
    parsed = parseGoogleChatZip(zipPath)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 })
  }

  if (!parsed.spaces.length) {
    return NextResponse.json({ error: 'No Google Chat spaces found in this ZIP. Make sure it is a Google Takeout export containing Google Chat data.' }, { status: 422 })
  }

  // Auto-match users by email
  const existingAuthors = await db`
    SELECT DISTINCT author_id, author_email FROM channel_messages WHERE org_id = ${session.orgId}
  ` as { author_id: string; author_email: string }[]
  const emailToId = new Map(existingAuthors.map(a => [a.author_email.toLowerCase(), a.author_id]))

  const userMapping: Record<string, string> = {}
  let autoMatched = 0
  for (const u of parsed.users) {
    if (emailToId.has(u.email.toLowerCase())) {
      userMapping[u.email] = emailToId.get(u.email.toLowerCase())!
      autoMatched++
    }
  }

  // Default space mapping: create new for SPACE type, skip DMs
  const spaceMapping: Record<string, {
    space_name: string; space_type: string
    foundry_channel_id: string | null; create_new: boolean; new_name: string | null; skip: boolean
  }> = {}
  for (const s of parsed.spaces) {
    const isDm = s.type === 'DIRECT_MESSAGE' || s.type === 'GROUP_DIRECT_MESSAGE'
    spaceMapping[s.id] = {
      space_name: s.name,
      space_type: s.type,
      foundry_channel_id: null,
      create_new: !isDm,
      new_name: s.name,
      skip: isDm,
    }
  }

  await db`
    INSERT INTO google_chat_import_jobs
      (id, org_id, created_by, status, filename, zip_path, user_mapping, space_mapping, gchat_spaces, gchat_users)
    VALUES
      (${jobId}, ${session.orgId}, ${session.userId}, 'pending', ${file.name}, ${zipPath},
       ${JSON.stringify(userMapping)}, ${JSON.stringify(spaceMapping)},
       ${JSON.stringify(parsed.spaces)}, ${JSON.stringify(parsed.users)})
  `

  const foundryChannels = await db`
    SELECT id, name FROM channels WHERE org_id = ${session.orgId} AND is_archived = false AND type = 'stream'
    ORDER BY name ASC
  `

  return NextResponse.json({
    jobId,
    spaces: parsed.spaces,
    users: parsed.users,
    user_mapping: userMapping,
    space_mapping: spaceMapping,
    auto_matched: autoMatched,
    foundry_channels: foundryChannels,
  }, { status: 201 })
}
