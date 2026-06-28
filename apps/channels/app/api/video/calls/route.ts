import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'
import { broadcastToOrg } from '@/lib/sse'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channelId, topicId, title } = await req.json() as {
    channelId: string; topicId?: string; title?: string
  }
  if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 })

  const [channel] = await db`
    SELECT id, name FROM channels WHERE id = ${channelId} AND org_id = ${session.orgId}
  `
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  const roomName = `foundry-${session.orgId.slice(0, 8)}-${Date.now()}`
  const callTitle = title ?? (channel.name as string)

  const [call] = await db`
    INSERT INTO video_calls
      (org_id, channel_id, topic_id, livekit_room_name, title, created_by, created_by_name)
    VALUES
      (${session.orgId}, ${channelId}, ${topicId ?? null}, ${roomName},
       ${callTitle}, ${session.userId}, ${session.name ?? session.email})
    RETURNING id, title, status
  `

  // Post a message to the topic so the call link persists in chat history
  if (topicId) {
    const baseUrl = process.env.FOUNDRY_WORKSPACE_URL ?? ''
    const msgBody = `📞 Started a video call → ${baseUrl}/call/${call.id}`
    const [msg] = await db`
      INSERT INTO channel_messages
        (channel_id, topic_id, org_id, author_id, author_name, author_email, body)
      VALUES
        (${channelId}, ${topicId}, ${session.orgId}, ${session.userId},
         ${session.name ?? session.email}, ${session.email}, ${msgBody})
      RETURNING id, author_id, author_name, author_email, body, reactions, edited_at, created_at
    `
    await db`
      UPDATE channel_topics SET last_message_at = now(), message_count = message_count + 1
      WHERE id = ${topicId}
    `
    broadcastToOrg(session.orgId, { type: 'message:new', channelId, topicId, message: msg })
  }

  broadcastToOrg(session.orgId, {
    type: 'call:started',
    callId: call.id,
    channelId,
    topicId: topicId ?? null,
    title: call.title,
    createdByName: session.name ?? session.email,
  })

  return NextResponse.json({ callId: call.id }, { status: 201 })
}
