'use client'

import { useState } from 'react'

type Channel = { id: string; name: string; type: string }
type Topic   = { id: string; name: string; last_message_at: string | null; message_count: number; is_resolved: boolean }

interface Props {
  orgSlug:         string
  channels:        Channel[]
  activeChannelId: string
  topics:          Topic[]
  activeTopicId:   string
  userId:          string
}

export function StreamList({ orgSlug, channels, activeChannelId, topics, activeTopicId }: Props) {
  const [newChannelName, setNewChannelName] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [showNewTopic, setShowNewTopic] = useState(false)
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
        setNewChannelName('')
        setShowNewChannel(false)
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
        setNewTopicName('')
        setShowNewTopic(false)
        window.location.href = `/org/${orgSlug}/${activeChannelId}/${topic.id}`
      }
    } finally { setCreating(false) }
  }

  return (
    <aside className="w-60 shrink-0 bg-bg-surface border-r border-border flex flex-col overflow-hidden">
      {/* Channels section */}
      <div className="flex-1 overflow-y-auto py-3">
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
                onKeyDown={e => { if (e.key === 'Enter') createChannel(); if (e.key === 'Escape') { setShowNewChannel(false); setNewChannelName('') } }}
                placeholder="channel-name"
                className="flex-1 bg-bg-raised border border-border rounded px-2 py-1 text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        {channels.map(channel => {
          const isActive = channel.id === activeChannelId
          const channelTopics = isActive ? topics : []

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
                <span className="truncate">{channel.name}</span>
              </a>

              {/* Topics for the active channel */}
              {isActive && (
                <div className="ml-5 border-l border-border pl-2">
                  {channelTopics
                    .filter(t => !t.is_resolved)
                    .map(topic => (
                      <a
                        key={topic.id}
                        href={`/org/${orgSlug}/${channel.id}/${topic.id}`}
                        className={`flex items-center gap-1.5 px-2 py-0.5 text-[13px] rounded transition-colors truncate ${
                          topic.id === activeTopicId
                            ? 'bg-bg-active text-accent font-medium'
                            : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-hover'
                        }`}
                      >
                        <span className="truncate">{topic.name}</span>
                        {topic.message_count > 0 && topic.id !== activeTopicId && (
                          <span className="ml-auto text-[10px] text-fg-tertiary shrink-0">
                            {topic.message_count}
                          </span>
                        )}
                      </a>
                    ))}

                  {/* New topic */}
                  {showNewTopic ? (
                    <div className="px-2 py-1">
                      <input
                        autoFocus
                        value={newTopicName}
                        onChange={e => setNewTopicName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') createTopic(); if (e.key === 'Escape') { setShowNewTopic(false); setNewTopicName('') } }}
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
      </div>

      {/* Bottom: user */}
      <div className="border-t border-border px-3 py-2.5 shrink-0">
        <a href="/logout" className="text-xs text-fg-tertiary hover:text-fg-primary transition-colors">
          Sign out
        </a>
      </div>
    </aside>
  )
}
