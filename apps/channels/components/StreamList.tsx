'use client'

import { useState } from 'react'

type Channel = { id: string; name: string; type: string }
type Topic   = { id: string; name: string; last_message_at: string | null; message_count: number; is_resolved: boolean }
type DM      = { id: string; metadata: { participants: { id: string; name: string; email: string }[] }; topic_id: string | null; last_message_at: string | null }

interface Props {
  orgSlug:         string
  channels:        Channel[]
  activeChannelId: string
  topics:          Topic[]
  activeTopicId:   string
  userId:          string
  unread:          Record<string, number>
  dms:             DM[]
}

function dmDisplayName(dm: DM, userId: string): string {
  const other = dm.metadata?.participants?.find(p => p.id !== userId)
  return other?.name ?? other?.email ?? 'Direct Message'
}

export function StreamList({ orgSlug, channels, activeChannelId, topics, activeTopicId, userId, unread, dms }: Props) {
  const [newChannelName, setNewChannelName] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [showNewTopic, setShowNewTopic] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const [creating, setCreating] = useState(false)

  async function createChannel() {
    if (!newChannelName.trim() || creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newChannelName.trim() }),
      })
      if (res.ok) {
        const ch = await res.json() as { id: string }
        setNewChannelName(''); setShowNewChannel(false)
        window.location.href = `/org/${orgSlug}/${ch.id}`
      }
    } finally { setCreating(false) }
  }

  async function createTopic() {
    if (!newTopicName.trim() || creating) return
    setCreating(true)
    try {
      const res = await fetch(`/api/channels/${activeChannelId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTopicName.trim() }),
      })
      if (res.ok) {
        const topic = await res.json() as { id: string }
        setNewTopicName(''); setShowNewTopic(false)
        window.location.href = `/org/${orgSlug}/${activeChannelId}/${topic.id}`
      }
    } finally { setCreating(false) }
  }

  const streamChannels = channels.filter(c => c.type !== 'dm')
  const totalUnreadForChannel = (channelId: string) => {
    return topics
      .filter(t => t.id !== activeTopicId)
      .reduce((sum, t) => sum + (unread[t.id] ?? 0), 0)
  }

  return (
    <aside className="w-60 shrink-0 bg-bg-surface border-r border-border flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto py-3">

        {/* Channels section */}
        <div className="px-3 mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-widest">Channels</span>
          <button
            onClick={() => setShowNewChannel(v => !v)}
            className="text-fg-tertiary hover:text-fg-primary transition-colors p-0.5 rounded"
            title="New channel"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/>
            </svg>
          </button>
        </div>

        {showNewChannel && (
          <div className="px-3 mb-2">
            <div className="flex gap-1">
              <span className="text-fg-tertiary text-sm pt-1">#</span>
              <input
                autoFocus
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') createChannel()
                  if (e.key === 'Escape') { setShowNewChannel(false); setNewChannelName('') }
                }}
                placeholder="channel-name"
                className="flex-1 bg-bg-raised border border-border rounded px-2 py-1 text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        {streamChannels.map(channel => {
          const isActive = channel.id === activeChannelId
          const channelTopics = isActive ? topics : []
          const visibleTopics = channelTopics.filter(t => showResolved || !t.is_resolved)
          const resolvedCount = channelTopics.filter(t => t.is_resolved).length
          const channelUnread = !isActive
            ? channelTopics.reduce((sum, t) => sum + (unread[t.id] ?? 0), 0)
            : 0

          return (
            <div key={channel.id}>
              <a
                href={`/org/${orgSlug}/${channel.id}`}
                className={`flex items-center gap-1.5 px-3 py-1 text-sm transition-colors ${
                  isActive
                    ? 'text-fg-primary font-medium'
                    : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-hover'
                }`}
              >
                <span className="text-fg-tertiary">#</span>
                <span className="truncate flex-1">{channel.name}</span>
                {channelUnread > 0 && (
                  <span className="ml-auto shrink-0 min-w-[18px] h-[18px] bg-accent text-accent-fg text-[10px] font-semibold rounded-full flex items-center justify-center px-1">
                    {channelUnread > 99 ? '99+' : channelUnread}
                  </span>
                )}
              </a>

              {isActive && (
                <div className="ml-5 border-l border-border pl-2">
                  {visibleTopics.map(topic => {
                    const topicUnread = unread[topic.id] ?? 0
                    const isActiveTopic = topic.id === activeTopicId
                    return (
                      <a
                        key={topic.id}
                        href={`/org/${orgSlug}/${channel.id}/${topic.id}`}
                        className={`flex items-center gap-1.5 px-2 py-0.5 text-[13px] rounded transition-colors ${
                          isActiveTopic
                            ? 'bg-bg-active text-accent font-medium'
                            : topic.is_resolved
                              ? 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-hover line-through'
                              : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-hover'
                        }`}
                      >
                        <span className="truncate flex-1">{topic.name}</span>
                        {topicUnread > 0 && !isActiveTopic && (
                          <span className="ml-auto shrink-0 w-1.5 h-1.5 bg-accent rounded-full" />
                        )}
                        {topic.message_count > 0 && topicUnread === 0 && !isActiveTopic && (
                          <span className="ml-auto text-[10px] text-fg-tertiary shrink-0">{topic.message_count}</span>
                        )}
                      </a>
                    )
                  })}

                  {resolvedCount > 0 && (
                    <button
                      onClick={() => setShowResolved(v => !v)}
                      className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-fg-tertiary hover:text-fg-secondary transition-colors w-full"
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className={`w-2.5 h-2.5 transition-transform ${showResolved ? 'rotate-90' : ''}`}>
                        <path d="M6 3l5 5-5 5V3z"/>
                      </svg>
                      {resolvedCount} resolved
                    </button>
                  )}

                  {showNewTopic ? (
                    <div className="px-2 py-1">
                      <input
                        autoFocus
                        value={newTopicName}
                        onChange={e => setNewTopicName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') createTopic()
                          if (e.key === 'Escape') { setShowNewTopic(false); setNewTopicName('') }
                        }}
                        placeholder="topic name"
                        className="w-full bg-bg-raised border border-border rounded px-2 py-0.5 text-xs text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-accent"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewTopic(true)}
                      className="flex items-center gap-1 px-2 py-0.5 text-[12px] text-fg-tertiary hover:text-fg-secondary transition-colors w-full"
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                        <path d="M8.75 3.75a.75.75 0 00-1.5 0v3.5h-3.5a.75.75 0 000 1.5h3.5v3.5a.75.75 0 001.5 0v-3.5h3.5a.75.75 0 000-1.5h-3.5v-3.5z"/>
                      </svg>
                      New topic
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Direct Messages section */}
        {dms.length > 0 && (
          <div className="mt-4">
            <div className="px-3 mb-1">
              <span className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-widest">Direct Messages</span>
            </div>
            {dms.map(dm => {
              const name = dmDisplayName(dm, userId)
              const isActive = dm.id === activeChannelId
              const dmUnread = dm.topic_id ? (unread[dm.topic_id] ?? 0) : 0
              return (
                <a
                  key={dm.id}
                  href={dm.topic_id ? `/org/${orgSlug}/${dm.id}/${dm.topic_id}` : `/org/${orgSlug}/${dm.id}`}
                  className={`flex items-center gap-2 px-3 py-1 text-sm transition-colors ${
                    isActive
                      ? 'text-fg-primary font-medium'
                      : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-hover'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-bg-active border border-border shrink-0" />
                  <span className="truncate flex-1">{name}</span>
                  {dmUnread > 0 && (
                    <span className="ml-auto shrink-0 w-1.5 h-1.5 bg-accent rounded-full" />
                  )}
                </a>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom */}
      <div className="border-t border-border px-3 py-2.5 shrink-0">
        <a href="/logout" className="text-xs text-fg-tertiary hover:text-fg-primary transition-colors">
          Sign out
        </a>
      </div>
    </aside>
  )
}
