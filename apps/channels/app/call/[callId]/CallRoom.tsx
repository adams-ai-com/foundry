'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  ControlBar,
  RoomAudioRenderer,
  useParticipants,
  useTracks,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import '@livekit/components-styles'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  callId:    string
  title:     string
  serverUrl: string
  channelId: string | null
  topicId:   string | null
  isCreator: boolean
}

type Message = {
  id: string; author_name: string; body: string; created_at: string; is_guest?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useElapsedTimer(active: boolean) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [active])
  const m = Math.floor(elapsed / 60).toString().padStart(2, '0')
  const s = (elapsed % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ─── Inner components (must be inside LiveKitRoom) ────────────────────────

function VideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera,      withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )
  return (
    <GridLayout tracks={tracks} className="flex-1">
      <ParticipantTile />
    </GridLayout>
  )
}

function ParticipantCount() {
  const participants = useParticipants()
  return <span className="text-white/50 text-xs">{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
}

// ─── Recording button ─────────────────────────────────────────────────────

function RecordingButton({ callId, isCreator }: { callId: string; isCreator: boolean }) {
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (loading || !isCreator) return
    setLoading(true)
    try {
      const res = await fetch(`/api/video/calls/${callId}/recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: recording ? 'stop' : 'start' }),
      })
      const d = await res.json() as { recording_enabled?: boolean }
      if (d.recording_enabled !== undefined) setRecording(d.recording_enabled)
    } catch {}
    finally { setLoading(false) }
  }

  if (!isCreator) {
    return recording
      ? <span className="flex items-center gap-1 text-xs text-red-400"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />REC</span>
      : null
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={recording ? 'Stop recording' : 'Start recording'}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
        recording
          ? 'border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20'
          : 'border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${recording ? 'bg-red-500 animate-pulse' : 'bg-white/30'}`} />
      {recording ? 'Recording' : 'Record'}
    </button>
  )
}

// ─── Chat panel ───────────────────────────────────────────────────────────

function ChatPanel({ channelId, topicId, onClose }: {
  channelId: string | null; topicId: string | null; onClose: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async () => {
    if (!channelId || !topicId) return
    try {
      const res = await fetch(`/api/channels/${channelId}/topics/${topicId}/messages`)
      if (res.ok) setMessages(await res.json() as Message[])
    } catch {}
  }, [channelId, topicId])

  useEffect(() => {
    fetchMessages()
    const id = setInterval(fetchMessages, 5000)
    return () => clearInterval(id)
  }, [fetchMessages])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!body.trim() || sending || !channelId || !topicId) return
    setSending(true)
    try {
      const res = await fetch(`/api/channels/${channelId}/topics/${topicId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      })
      if (res.ok) {
        const msg = await res.json() as Message
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        setBody('')
      }
    } catch {}
    finally { setSending(false) }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col w-72 border-l border-white/10 bg-neutral-900/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-medium text-white">Topic chat</span>
        <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
          </svg>
        </button>
      </div>

      {!channelId || !topicId ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/30 text-xs text-center px-4">Chat is available when the call is linked to a topic.</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {messages.length === 0 && (
              <p className="text-white/20 text-xs text-center mt-8">No messages yet.</p>
            )}
            {messages.map(msg => (
              <div key={msg.id} className="text-xs">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-medium text-white/80">{msg.author_name}</span>
                  <span className="text-white/30">{formatTime(msg.created_at)}</span>
                </div>
                <p className="text-white/60 leading-relaxed break-words">{msg.body}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 px-3 pb-3">
            <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-white/20 transition-colors">
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                }}
                placeholder="Message topic…"
                rows={1}
                className="flex-1 bg-transparent text-xs text-white/80 placeholder:text-white/25 resize-none focus:outline-none leading-relaxed"
                style={{ minHeight: 20 }}
              />
              <button
                onClick={send}
                disabled={!body.trim() || sending}
                className="shrink-0 w-6 h-6 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-lg flex items-center justify-center transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white">
                  <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z"/>
                </svg>
              </button>
            </div>
            <p className="text-[9px] text-white/20 mt-1 ml-1">Messages are saved to the topic.</p>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Call header (inside LiveKitRoom so it can use hooks) ─────────────────

function CallHeader({ callId, title, isCreator, showChat, onToggleChat, onDisconnect }: {
  callId: string; title: string; isCreator: boolean
  showChat: boolean; onToggleChat: () => void; onDisconnect: () => void
}) {
  const elapsed = useElapsedTimer(true)

  return (
    <div className="shrink-0 h-11 flex items-center px-4 gap-3 bg-neutral-950/80 border-b border-white/5">
      <button
        onClick={onDisconnect}
        className="text-white/40 hover:text-white/70 transition-colors shrink-0"
        title="Leave call"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd"/>
        </svg>
      </button>

      <span className="font-medium text-white text-sm truncate flex-1">{title}</span>

      <div className="flex items-center gap-3 shrink-0">
        <RecordingButton callId={callId} isCreator={isCreator} />
        <span className="text-white/30 text-xs font-mono">{elapsed}</span>
        <ParticipantCount />
        <button
          onClick={onToggleChat}
          title="Toggle chat"
          className={`p-1.5 rounded-lg transition-colors ${showChat ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M3.43 2.524A41.29 41.29 0 0110 2c2.236 0 4.43.18 6.57.524 1.437.231 2.43 1.49 2.43 2.902v5.148c0 1.413-.993 2.67-2.43 2.902a41.202 41.202 0 01-5.183.501.75.75 0 00-.511.195l-3.06 2.733A.75.75 0 016 16.25v-2.88a41.033 41.033 0 01-2.57-.394C1.993 12.724 1 11.467 1 10.054V5.426c0-1.413.993-2.67 2.43-2.902z" clipRule="evenodd"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Main exported component ─────────────────────────────────────────────

export function CallRoom({ callId, title, serverUrl, channelId, topicId, isCreator }: Props) {
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [showChat, setShowChat] = useState(false)

  useEffect(() => {
    fetch(`/api/video/calls/${callId}/join`, { method: 'POST' })
      .then(r => r.json())
      .then((d: { token?: string; error?: string }) => {
        if (d.token) setToken(d.token)
        else setError(d.error ?? 'Failed to join call')
      })
      .catch(() => setError('Unable to connect. Check your network.'))
  }, [callId])

  const handleDisconnect = useCallback(async () => {
    if (leaving) return
    setLeaving(true)
    await fetch(`/api/video/calls/${callId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'leave' }),
    }).catch(() => {})
    window.close()
  }, [callId, leaving])

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-red-400">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
            </svg>
          </div>
          <p className="text-white text-sm font-medium mb-1">Unable to join</p>
          <p className="text-white/40 text-xs max-w-xs">{error}</p>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/40 text-sm">Joining <span className="text-white/70">{title}</span>…</p>
        </div>
      </div>
    )
  }

  if (!serverUrl) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white text-sm font-medium mb-2">Video not configured</p>
          <p className="text-white/40 text-xs">Set NEXT_PUBLIC_LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.</p>
        </div>
      </div>
    )
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      onDisconnected={handleDisconnect}
      style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#171717' }}
      data-lk-theme="default"
    >
      <RoomAudioRenderer />

      {/* Header */}
      <CallHeader
        callId={callId}
        title={title}
        isCreator={isCreator}
        showChat={showChat}
        onToggleChat={() => setShowChat(c => !c)}
        onDisconnect={handleDisconnect}
      />

      {/* Body: video grid + optional chat */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <VideoGrid />
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <ControlBar controls={{ microphone: true, camera: true, screenShare: true, chat: false, leave: true }} />
          </div>
        </div>
        {showChat && (
          <ChatPanel channelId={channelId} topicId={topicId} onClose={() => setShowChat(false)} />
        )}
      </div>
    </LiveKitRoom>
  )
}
