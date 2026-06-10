import { redirect } from 'next/navigation'
import { requireSession } from '@foundry/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export default async function OrgChannelsPage({ params }: Props) {
  const { slug } = await params
  const session = await requireSession()
  if (session.orgSlug !== slug) redirect(`/org/${session.orgSlug}`)

  // Auto-create default channels if the org has none
  const existing = await db`
    SELECT id, name FROM channels WHERE org_id = ${session.orgId!} AND is_archived = false ORDER BY created_at ASC
  `

  if (existing.length === 0) {
    const [general] = await db`
      INSERT INTO channels (org_id, name, description, created_by)
      VALUES (${session.orgId!}, 'general', 'General discussion', ${session.userId})
      ON CONFLICT (org_id, name) DO NOTHING
      RETURNING id
    `
    await db`
      INSERT INTO channels (org_id, name, description, created_by)
      VALUES (${session.orgId!}, 'announcements', 'Important updates', ${session.userId})
      ON CONFLICT (org_id, name) DO NOTHING
    `
    // seed a welcome topic in general
    if (general?.id) {
      const [topic] = await db`
        INSERT INTO channel_topics (channel_id, org_id, name, created_by)
        VALUES (${general.id}, ${session.orgId!}, 'welcome', ${session.userId})
        RETURNING id
      `
      if (topic?.id) {
        const authorName = session.name ?? session.email.split('@')[0]
        await db`
          INSERT INTO channel_messages
            (channel_id, topic_id, org_id, author_id, author_name, author_email, body)
          VALUES
            (${general.id}, ${topic.id}, ${session.orgId!}, ${session.userId},
             ${authorName}, ${session.email},
             'Welcome to Channels! Start a new topic to kick off a conversation.')
        `
        await db`
          UPDATE channel_topics SET last_message_at = now(), message_count = 1 WHERE id = ${topic.id}
        `
      }
      redirect(`/org/${slug}/${general.id}/${topic?.id ?? ''}`)
    }
  }

  // redirect to first channel's most-recent topic
  const firstChannel = existing[0] as { id: string; name: string }
  const topics = await db`
    SELECT id FROM channel_topics
    WHERE channel_id = ${firstChannel.id} AND org_id = ${session.orgId!}
    ORDER BY COALESCE(last_message_at, created_at) DESC
    LIMIT 1
  `
  if (topics.length) {
    redirect(`/org/${slug}/${firstChannel.id}/${(topics[0] as { id: string }).id}`)
  }
  redirect(`/org/${slug}/${firstChannel.id}`)
}
