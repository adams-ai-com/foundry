'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer as ArrayBuffer
}

type Status = 'idle' | 'unsupported' | 'denied' | 'subscribed' | 'error'

export function PushNotificationSetup() {
  const [status, setStatus] = useState<Status>('idle')
  const [isIos, setIsIos] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
    setIsIos(ios)
    setIsStandalone(standalone)

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied')
      return
    }
    // Check if already subscribed
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
      if (sub) setStatus('subscribed')
    }).catch(() => {})
  }, [])

  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const res = await fetch('/api/push/vapid-public-key')
      if (!res.ok) throw new Error('Push not configured on server')
      const { publicKey } = await res.json() as { publicKey: string }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })

      setStatus('subscribed')
    } catch (err) {
      console.error('[push] subscribe failed:', err)
      if (Notification.permission === 'denied') setStatus('denied')
      else setStatus('error')
    }
  }

  // Don't render anything if already subscribed or truly unsupported
  if (status === 'subscribed') return null
  if (status === 'unsupported' && !isIos) return null

  // iOS Safari (not standalone) — show Add to Home Screen prompt
  if (isIos && !isStandalone) {
    return (
      <div className="mx-4 mt-3 flex items-start gap-3 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm">
        <span className="text-lg shrink-0">📱</span>
        <div>
          <p className="font-medium text-indigo-900">Enable push notifications on iPhone</p>
          <p className="text-indigo-700 mt-0.5">
            Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> in Safari, then open Foundry from your home screen.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="mx-4 mt-3 flex items-start gap-3 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm">
        <span className="text-lg shrink-0">🔕</span>
        <p className="text-yellow-800">
          Notifications blocked. Enable them in your browser settings to get @mention and DM alerts.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg">🔔</span>
        <p className="text-indigo-900 font-medium">Get notified for @mentions and DMs</p>
      </div>
      <button
        onClick={() => void register()}
        className="shrink-0 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
      >
        Enable
      </button>
    </div>
  )
}
