'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const DEFAULT_COLOR = '#2563eb'

export default function BrandingPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [brandColor, setBrandColor] = useState(DEFAULT_COLOR)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/pdf/api/envelope-branding')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        setDisplayName(d.display_name ?? '')
        setLogoUrl(d.logo_url ?? '')
        setBrandColor(d.brand_color ?? DEFAULT_COLOR)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/pdf/api/envelope-branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName, logo_url: logoUrl, brand_color: brandColor }),
      })
      if (res.ok) setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="animate-pulse text-fg-tertiary text-sm">Loading…</div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <button onClick={() => router.push('/pdf/envelopes')}
          className="text-xs text-fg-tertiary hover:text-fg-secondary mb-1 flex items-center gap-1">
          ← Envelopes
        </button>
        <h1 className="text-lg font-semibold text-fg-primary">Signing page branding</h1>
        <p className="text-xs text-fg-tertiary mt-0.5">
          Customise how the signing page looks to your recipients.
        </p>
      </div>

      <div className="bg-bg-raised border border-border rounded-xl p-6 space-y-5">
        {/* Display name */}
        <label className="block">
          <span className="text-xs font-medium text-fg-secondary">Display name</span>
          <p className="text-xs text-fg-tertiary mb-1">Shown in the signing page header and invitation emails.</p>
          <input
            value={displayName}
            onChange={e => { setDisplayName(e.target.value); setSaved(false) }}
            placeholder="Your company name"
            maxLength={120}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-fg-primary"
          />
        </label>

        {/* Logo URL */}
        <label className="block">
          <span className="text-xs font-medium text-fg-secondary">Logo URL</span>
          <p className="text-xs text-fg-tertiary mb-1">Link to a PNG or SVG. Appears in the header of the signing page.</p>
          <input
            value={logoUrl}
            onChange={e => { setLogoUrl(e.target.value); setSaved(false) }}
            placeholder="https://example.com/logo.png"
            type="url"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-fg-primary"
          />
          {logoUrl && (
            <div className="mt-2 p-3 bg-bg-surface border border-border rounded-lg flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Logo preview" className="h-8 object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <span className="text-xs text-fg-tertiary">Preview</span>
            </div>
          )}
        </label>

        {/* Brand color */}
        <label className="block">
          <span className="text-xs font-medium text-fg-secondary">Brand color</span>
          <p className="text-xs text-fg-tertiary mb-1">Used for the submit button, progress bar, and accents.</p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={e => { setBrandColor(e.target.value); setSaved(false) }}
              className="h-9 w-16 rounded border border-border cursor-pointer bg-bg-base p-0.5"
            />
            <input
              value={brandColor}
              onChange={e => {
                const v = e.target.value
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                  setBrandColor(v)
                  setSaved(false)
                }
              }}
              maxLength={7}
              className="w-28 border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-fg-primary font-mono"
            />
            <div className="h-9 w-20 rounded-lg flex items-center justify-center text-white text-xs font-medium shadow-sm"
              style={{ backgroundColor: brandColor }}>
              Button
            </div>
          </div>
        </label>

        {/* Preview strip */}
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="h-6 object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : (
              <div className="w-5 h-5 rounded" style={{ backgroundColor: brandColor }} />
            )}
            <span className="text-sm font-semibold text-gray-900">
              {displayName || 'Your company name'}
            </span>
          </div>
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">Preview of signing page header</span>
            <div className="px-4 py-1.5 rounded-lg text-white text-xs font-medium"
              style={{ backgroundColor: brandColor }}>
              Sign Document →
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium bg-accent text-accent-fg rounded-lg hover:opacity-90 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save branding'}
          </button>
          {saved && <span className="text-xs text-green-600 font-medium">✓ Saved</span>}
        </div>
      </div>

      <p className="text-xs text-fg-tertiary mt-4">
        Branding is snapshotted when an envelope is created. Existing envelopes keep the branding they were created with.
      </p>
    </div>
  )
}
