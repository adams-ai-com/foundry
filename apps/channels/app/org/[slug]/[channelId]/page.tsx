import { redirect } from 'next/navigation'
import { requireSession } from '@foundry/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string; channelId: string }> }

export default async function ChannelPage({ params }: Props) {
  const { slug, channelId } = await params
  const session = await requireSession()

  const topics = await db`
    SELECT id FROM channel_topics
    WHERE channel_id = ${channelId} AND org_id = ${session.orgId!}
    ORDER BY COALESCE(last_message_at, created_at) DESC
    LIMIT 1
  `

  if (topics.length) {
    redirect(`/org/${slug}/${channelId}/${(topics[0] as { id: string }).id}`)
  }

  // No topics yet — show the shell with a prompt to create one
  redirect(`/org/${slug}/${channelId}/_new`)
}
