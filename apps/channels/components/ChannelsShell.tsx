'use client'

import { useState, useEffect, useRef } from 'react'
import type { SessionUser } from '@foundry/auth'
import { StreamList } from './StreamList'
import { MessagePanel } from './MessagePanel'

type Channel   = { id: string; name: string; type: string }
type Topic     = { id: string; name: string; last_message_at: string | null; message_count: number; is_resolved: boolean }
type Message   = { id: string; author_id: string; author_name: string; author_email: string; body: string; reactions: unknown[]; edited_at: string | null; created_at: string }

interface Props {
  session:          SessionUser
  orgSlug:          string
  theme:            'light' | 'dark' | 'warm'
  channels:         Channel[]
  activeChannelId:  string
  activeChannel:    { id: string; name: string }
  topics:           Topic[]
  activeTopicId:    string
  activeTopic:      { id: string; name: string } | null
  initialMessages:  Message[]
}

export function ChannelsShell({
  session, orgSlug, theme,
  channels, activeChannelId, activeChannel,
  topics, activeTopicId, activeTopic, initialMessages,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [liveTopics, setLiveTopics] = useState<Topic[]>(topics)
  const sseRef = useRef<EventSource | null>(null)

  // Re-sync when the page navigates to a different topic
  useEffect(() => {
    setMessages(initialMessages)
  }, [activeTopicId, initialMessages])

  useEffect(() => {
    setLiveTopics(topics)
  }, [topics])

  // SSE connection
  useEffect(() => {
    const es = new EventSource('/api/sse')
    sseRef.current = es

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as {
          type: string; channelId: string; topicId: string; message: Message
        }
        if (event.type === 'message:new') {
          // Update message list if we're on that topic
          if (event.channelId === activeChannelId && event.topicId === activeTopicId) {
            setMessages(prev => {
              if (prev.some(m => m.id === event.message.id)) return prev
              return [...prev, event.message]
            })
          }
          // Update topic last_message_at in sidebar
          if (event.channelId === activeChannelId) {
            setLiveTopics(prev => prev.map(t =>
              t.id === event.topicId
                ? { ...t, last_message_at: event.message.created_at, message_count: t.message_count + 1 }
                : t
            ))
          }
        }
      } catch {}
    }

    return () => es.close()
  }, [activeChannelId, activeTopicId])

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top nav */}
      <header className="h-12 bg-bg-raised border-b border-border flex items-center px-4 gap-4 shrink-0 z-20">
        <a href={`/org/${orgSlug}`} className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-accent-fg">
              <path d="M4 5a1 1 0 011-1h14a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h10a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h6a1 1 0 010 2H5a1 1 0 01-1-1z"/>
            </svg>
          </div>
          <span className="font-semibold text-fg-primary text-sm hidden sm:block">Foundry</span>
        </a>

        <nav className="flex items-center gap-0.5">
          {[
            { id: 'docs',     label: 'Docs',     href: '/docs' },
            { id: 'sheets',   label: 'Sheets',   href: '/sheets' },
            { id: 'mail',     label: 'Mail',     href: '/mail' },
            { id: 'channels', label: 'Channels', href: `/org/${orgSlug}` },
            { id: 'wiki',     label: 'Wiki',     href: '/wiki' },
          ].map(app => (
            <a
              key={app.id}
              href={app.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                app.id === 'channels'
                  ? 'bg-bg-active text-accent'
                  : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-hover'
              }`}
            >
              {app.label}
            </a>
          ))}
        </nav>

        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-accent/15 rounded-full flex items-center justify-center">
            <span className="text-accent text-xs font-semibold">
              {(session.name ?? session.email).slice(0, 2).toUpperCase()}
            </span>
          </div>
          <span className="text-sm text-fg-secondary hidden lg:block">{session.email}</span>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        <StreamList
          orgSlug={orgSlug}
          channels={channels}
          activeChannelId={activeChannelId}
          topics={liveTopics}
          activeTopicId={activeTopicId}
          userId={session.userId}
        />

        <MessagePanel
          orgSlug={orgSlug}
          session={session}
          channelId={activeChannelId}
          channelName={activeChannel.name}
          topicId={activeTopicId}
          topicName={activeTopic?.name ?? null}
          messages={messages}
          onNewMessage={(msg) => {
            setMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev
              return [...prev, msg]
            })
          }}
        />
      </div>
    </div>
  )
}
