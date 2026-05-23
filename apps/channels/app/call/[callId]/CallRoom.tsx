'use client'

import { useEffect, useState, useCallback } from 'react'
import { LiveKitRoom, VideoConference } from '@livekit/components-react'
import '@livekit/components-styles'

interface Props {
  callId: string
  title: string
  serverUrl: string
}

export function CallRoom({ callId, title, serverUrl }: Props) {
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)

  useEffect(() => {
    fetch(`/api/video/calls/${callId}/join`, { method: 'POST' })
      .then(r => r.json())
      .then((data: { token?: string; serverUrl?: string; error?: string }) => {
        if (data.token) setToken(data.token)
        else setError(data.error ?? 'Failed to join call')
      })
      .catch(() => setError('Unable to connect. Check your network and try again.'))
  }, [callId])

  const handleDisconnect = useCallback(async () => {
    if (ending) return
    setEnding(true)
    await fetch(`/api/video/calls/${callId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'leave' }),
    }).catch(() => {})
    window.close()
  }, [callId, ending])

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
          <p className="text-white/40 text-xs mb-4 max-w-xs">{error}</p>
          <button
            onClick={() => window.close()}
            className="text-xs text-white/40 hover:text-white/60 border border-white/10 rounded-lg px-4 py-2 transition-colors"
          >
            Close
          </button>
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
          <p className="text-white/40 text-xs">
            Set <code className="font-mono">NEXT_PUBLIC_LIVEKIT_URL</code>,{' '}
            <code className="font-mono">LIVEKIT_API_KEY</code>, and{' '}
            <code className="font-mono">LIVEKIT_API_SECRET</code> to enable video calls.
          </p>
        </div>
      </div>
    )
  }

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={serverUrl}
      data-lk-theme="default"
      style={{ height: '100dvh' }}
      onDisconnected={handleDisconnect}
    >
      <VideoConference />
    </LiveKitRoom>
  )
}
