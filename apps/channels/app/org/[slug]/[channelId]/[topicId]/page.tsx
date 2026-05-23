import { redirect } from 'next/navigation'
import { requireSession } from '@foundry/auth'
import { cookies } from 'next/headers'
import db from '@/lib/db'
import { ChannelsShell } from '@/components/ChannelsShell'

export const dynamic = 'force-dynamic'

type Ch  = { id: string; name: string; type: string }
type Top = { id: string; name: string; last_message_at: string | null; message_count: number; is_resolved: boolean }
type Msg = { id: string; author_id: string; author_name: string; author_email: string; body: string; reactions: unknown[]; edited_at: string | null; created_at: string }

type Props = { params: Promise<{ slug: string; channelId: string; topicId: string }> }

export default async function TopicPage({ params }: Props) {
  const { slug, channelId, topicId } = await params
  const session = await requireSession()
  if (session.orgSlug !== slug) redirect(`/org/${session.orgSlug}`)

  const orgId = session.orgId!

  const [channelsRaw, activeChannelRaw, topicsRaw, messagesRaw] = await Promise.all([
    db`
      SELECT id, name, description, type, is_private
      FROM channels
      WHERE org_id = ${orgId} AND is_archived = false
      ORDER BY name ASC
    `,
    db`
      SELECT id, name FROM channels WHERE id = ${channelId} AND org_id = ${orgId}
    `,
    db`
      SELECT id, name, last_message_at, message_count, is_resolved
      FROM channel_topics
      WHERE channel_id = ${channelId} AND org_id = ${orgId}
      ORDER BY COALESCE(last_message_at, created_at) DESC
    `,
    topicId === '_new'
      ? Promise.resolve([])
      : db`
          SELECT id, author_id, author_name, author_email, body, reactions, edited_at, created_at
          FROM channel_messages
          WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND org_id = ${orgId}
            AND deleted_at IS NULL
          ORDER BY created_at ASC
          LIMIT 100
        `,
  ])

  const channels = channelsRaw as unknown as Ch[]
  const activeChannel = (activeChannelRaw[0] ?? null) as unknown as { id: string; name: string } | null
  const topics = topicsRaw as unknown as Top[]
  const messages = messagesRaw as unknown as Msg[]

  if (!activeChannel) redirect(`/org/${slug}`)

  const activeTopic = topicId === '_new'
    ? null
    : topics.find(t => t.id === topicId) ?? null

  const jar = await cookies()
  const theme = (jar.get('foundry_theme')?.value ?? 'light') as 'light' | 'dark' | 'warm'

  return (
    <ChannelsShell
      session={session}
      orgSlug={slug}
      theme={theme}
      channels={channels}
      activeChannelId={channelId}
      activeChannel={activeChannel}
      topics={topics}
      activeTopicId={topicId}
      activeTopic={activeTopic}
      initialMessages={messages}
    />
  )
}
