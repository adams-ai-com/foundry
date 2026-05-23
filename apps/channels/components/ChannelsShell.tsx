'use client'

import { useState, useEffect, useRef } from 'react'
import type { SessionUser } from '@foundry/auth'
import { StreamList } from './StreamList'
import { MessagePanel } from './MessagePanel'
import { MemoryPanel } from './MemoryPanel'
import { NotificationBell } from './NotificationBell'

type Channel = { id: string; name: string; type: string }
type Topic   = { id: string; name: string; last_message_at: string | null; message_count: number; is_resolved: boolean }
type Message = { id: string; author_id: string; author_name: string; author_email: string; body: string; reactions: { emoji: string; user_ids: string[] }[]; edited_at: string | null; created_at: string }
type DM      = { id: string; metadata: { participants: { id: string; name: string; email: string }[] }; topic_id: string | null; last_message_at: string | null }

interface Props {
  session:          SessionUser
  orgSlug:          string
  theme:            'light' | 'dark' | 'warm'
  channels:         Channel[]
  activeChannelId:  string
  activeChannel:    { id: string; name: string }
  topics:           Topic[]
  activeTopicId:    string
  activeTopic:      { id: string; name: string; is_resolved: boolean } | null
  initialMessages:  Message[]
  initialDms:       DM[]
  initialSummary:   { bullets: string[]; action_items: string[]; generated_at: string } | null
  initialActiveCall:{ id: string; title: string; createdByName: string } | null
}

export function ChannelsShell({
  session, orgSlug, theme,
  channels, activeChannelId, activeChannel,
  topics, activeTopicId, activeTopic, initialMessages, initialDms, initialSummary,
  initialActiveCall,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [liveTopics, setLiveTopics] = useState<Topic[]>(topics)
  const [liveActiveTopic, setLiveActiveTopic] = useState(activeTopic)
  const [dms, setDms] = useState<DM[]>(initialDms)
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [notifCount, setNotifCount] = useState(0)
  const [activeCallId, setActiveCallId] = useState<string | null>(initialActiveCall?.id ?? null)
  const [showMemory, setShowMemory] = useState(false)
  const sseRef = useRef<EventSource | null>(null)

  useEffect(() => { setMessages(initialMessages) }, [activeTopicId, initialMessages])
  useEffect(() => { setLiveTopics(topics) }, [topics])
  useEffect(() => { setLiveActiveTopic(activeTopic) }, [activeTopic])
  useEffect(() => { setActiveCallId(initialActiveCall?.id ?? null) }, [activeTopicId, initialActiveCall])

  // Load unread counts + notification count
  useEffect(() => {
    fetch('/api/channels/unread')
      .then(r => r.json())
      .then((data: Record<string, number>) => setUnread(data))
      .catch(() => {})
    fetch('/api/notifications')
      .then(r => r.json())
      .then((data: { count: number }) => setNotifCount(data.count))
      .catch(() => {})
  }, [activeTopicId])

  // Clear unread for current topic
  useEffect(() => {
    if (activeTopicId && activeTopicId !== '_new') {
      setUnread(prev => { const next = { ...prev }; delete next[activeTopicId]; return next })
    }
  }, [activeTopicId])

  // SSE connection
  useEffect(() => {
    const es = new EventSource('/api/sse')
    sseRef.current = es

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as {
          type: string
          channelId: string
          topicId?: string
          messageId?: string
          message?: Message
          topic?: Topic
        }

        if (event.type === 'message:new' && event.message) {
          if (event.channelId === activeChannelId && event.topicId === activeTopicId) {
            setMessages(prev => prev.some(m => m.id === event.message!.id) ? prev : [...prev, event.message!])
          } else if (event.topicId && event.topicId !== activeTopicId) {
            setUnread(prev => ({ ...prev, [event.topicId!]: (prev[event.topicId!] ?? 0) + 1 }))
          }
          if (event.channelId === activeChannelId && event.topicId) {
            setLiveTopics(prev => prev.map(t =>
              t.id === event.topicId
                ? { ...t, last_message_at: event.message!.created_at, message_count: t.message_count + 1 }
                : t
            ))
          }
        }

        if (event.type === 'message:edit' && event.message) {
          if (event.channelId === activeChannelId && event.topicId === activeTopicId) {
            setMessages(prev => prev.map(m => m.id === event.message!.id ? event.message! : m))
          }
        }

        if (event.type === 'message:delete' && event.messageId) {
          if (event.channelId === activeChannelId && event.topicId === activeTopicId) {
            setMessages(prev => prev.filter(m => m.id !== event.messageId))
          }
        }

        if (event.type === 'message:reaction' && event.message) {
          if (event.channelId === activeChannelId && event.topicId === activeTopicId) {
            setMessages(prev => prev.map(m => m.id === event.message!.id ? event.message! : m))
          }
        }

        if (event.type === 'mention:new') {
          const ev = event as unknown as { type: string; userIds: string[] }
          if (ev.userIds?.includes(session.userId)) {
            setNotifCount(prev => prev + 1)
          }
        }

        if (event.type === 'call:started') {
          const ev = event as unknown as { callId: string; topicId?: string | null }
          if (ev.topicId === activeTopicId) setActiveCallId(ev.callId)
        }

        if (event.type === 'call:ended') {
          const ev = event as unknown as { callId: string; topicId?: string | null }
          if (ev.topicId === activeTopicId) setActiveCallId(null)
        }

        if (event.type === 'topic:resolve' && event.topic) {
          if (event.channelId === activeChannelId) {
            setLiveTopics(prev => prev.map(t => t.id === event.topic!.id ? { ...t, ...event.topic! } : t))
            if (event.topic.id === activeTopicId) {
              setLiveActiveTopic(prev => prev ? { ...prev, is_resolved: event.topic!.is_resolved } : prev)
            }
          }
        }
      } catch {}
    }

    return () => es.close()
  }, [activeChannelId, activeTopicId])

  async function toggleResolve() {
    if (!liveActiveTopic) return
    const res = await fetch(`/api/channels/${activeChannelId}/topics/${activeTopicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_resolved: !liveActiveTopic.is_resolved }),
    })
    if (res.ok) {
      const updated = await res.json() as Topic
      setLiveActiveTopic(prev => prev ? { ...prev, is_resolved: updated.is_resolved } : prev)
      setLiveTopics(prev => prev.map(t => t.id === activeTopicId ? { ...t, is_resolved: updated.is_resolved } : t))
    }
  }

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMemory(m => !m)}
            title="Workspace Memory — Ask AI or view Timeline"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              showMemory
                ? 'bg-accent/15 text-accent'
                : 'text-fg-muted hover:text-fg-primary hover:bg-bg-hover'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
            </svg>
          </button>
          <NotificationBell orgSlug={orgSlug} count={notifCount} onCountChange={setNotifCount} />
          <div className="w-7 h-7 bg-accent/15 rounded-full flex items-center justify-center">
            <span className="text-accent text-xs font-semibold">
              {(session.name ?? session.email).slice(0, 2).toUpperCase()}
            </span>
          </div>
          <span className="text-sm text-fg-secondary hidden lg:block">{session.email}</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <StreamList
          orgSlug={orgSlug}
          channels={channels}
          activeChannelId={activeChannelId}
          topics={liveTopics}
          activeTopicId={activeTopicId}
          userId={session.userId}
          unread={unread}
          dms={dms}
        />

        {showMemory
          ? <MemoryPanel orgSlug={orgSlug} onClose={() => setShowMemory(false)} />
          : <MessagePanel
              orgSlug={orgSlug}
              session={session}
              channelId={activeChannelId}
              channelName={activeChannel.name}
              topicId={activeTopicId}
              topicName={liveActiveTopic?.name ?? null}
              isResolved={liveActiveTopic?.is_resolved ?? false}
              existingSummary={initialSummary}
              messages={messages}
              activeCallId={activeCallId}
              onNewMessage={msg => setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])}
              onEditMessage={msg => setMessages(prev => prev.map(m => m.id === msg.id ? msg : m))}
              onDeleteMessage={id => setMessages(prev => prev.filter(m => m.id !== id))}
              onReactMessage={msg => setMessages(prev => prev.map(m => m.id === msg.id ? msg : m))}
              onToggleResolve={toggleResolve}
              onCallStarted={callId => setActiveCallId(callId)}
            />
        }
      </div>
    </div>
  )
}
