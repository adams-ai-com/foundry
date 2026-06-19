'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SiteFile } from '@/lib/actions'

// ── File type icon ─────────────────────────────────────────────────────────────

function FileTypeIcon({ mimeType, className = '' }: { mimeType: string; className?: string }) {
  const cls = `w-full h-full ${className}`

  if (mimeType.startsWith('image/')) return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <path d="M21 15l-5-5L5 21"/>
    </svg>
  )

  if (mimeType === 'application/pdf') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <path d="M14 2v6h6"/>
      <path d="M9 13h1c.6 0 1 .4 1 1v1c0 .6-.4 1-1 1H9v-3z"/>
      <path d="M13 13h2M13 15h1.5M17 13v3"/>
    </svg>
  )

  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <path d="M14 2v6h6"/>
      <path d="M8 13h8M8 17h8M8 9h2"/>
    </svg>
  )

  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip') || mimeType.includes('compressed')) return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
      <path d="M12 2v6M12 16v6M12 8v4"/>
    </svg>
  )

  if (mimeType.startsWith('video/')) return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <rect x="2" y="2" width="20" height="20" rx="2.18"/>
      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>
    </svg>
  )

  if (mimeType.startsWith('audio/')) return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  )

  // default: generic doc
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
    </svg>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024)             return `${bytes} B`
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatDate(ts: string): string {
  const date = new Date(ts)
  const now  = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (diffDays < 1)   return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)   return date.toLocaleDateString('en-US', { weekday: 'long' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Component ──────────────────────────────────────────────────────────────────

export function FileList({ files }: { files: SiteFile[] }) {
  const router = useRouter()
  const [openingPdf, setOpeningPdf] = useState<string | null>(null)

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    await fetch(`/sites/api/file/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  async function openInFoundryPdf(id: string, name: string) {
    setOpeningPdf(id)
    try {
      const res = await fetch(`/sites/api/file/${id}`)
      if (!res.ok) throw new Error('Could not fetch file')
      const blob = await res.blob()
      const form = new FormData()
      form.append('file', new File([blob], name, { type: 'application/pdf' }))
      const up = await fetch('/pdf/api/pdf/upload', { method: 'POST', body: form })
      if (!up.ok) throw new Error('Upload failed')
      const { jobId } = await up.json()
      window.open(`/pdf/editor/${jobId}`, '_blank')
    } catch (e) {
      alert('Could not open PDF: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setOpeningPdf(null)
    }
  }

  if (files.length === 0) return null

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <ul className="divide-y divide-border">
        {files.map(f => (
          <li key={f.id} className="group flex items-center">
            {f.mimeType === 'application/pdf' ? (
              <button
                onClick={() => openInFoundryPdf(f.id, f.name)}
                disabled={openingPdf === f.id}
                className="flex-1 flex items-center gap-3.5 px-4 py-3 hover:bg-bg-hover transition-colors min-w-0 text-left disabled:opacity-60"
              >
                <div className="w-8 h-8 rounded-lg bg-bg-surface border border-border flex-shrink-0
                               flex items-center justify-center
                               group-hover:bg-accent/10 group-hover:border-accent/20 transition-all">
                  <div className="w-4 h-4 text-accent/50 group-hover:text-accent transition-colors">
                    <FileTypeIcon mimeType={f.mimeType} />
                  </div>
                </div>
                <span className="flex-1 text-sm font-medium text-fg-primary group-hover:text-accent
                                 transition-colors overflow-hidden text-ellipsis whitespace-nowrap">
                  {openingPdf === f.id ? 'Opening…' : f.name}
                </span>
                <span className="text-xs text-fg-tertiary shrink-0 tabular-nums ml-4">
                  {formatSize(f.size)}
                </span>
                <span className="text-xs text-fg-tertiary shrink-0 tabular-nums ml-3">
                  {formatDate(f.createdAt)}
                </span>
              </button>
            ) : (
              <a
                href={`/sites/api/file/${f.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center gap-3.5 px-4 py-3 hover:bg-bg-hover transition-colors min-w-0"
              >
                <div className="w-8 h-8 rounded-lg bg-bg-surface border border-border flex-shrink-0
                               flex items-center justify-center
                               group-hover:bg-accent/10 group-hover:border-accent/20 transition-all">
                  <div className="w-4 h-4 text-accent/50 group-hover:text-accent transition-colors">
                    <FileTypeIcon mimeType={f.mimeType} />
                  </div>
                </div>
                <span className="flex-1 text-sm font-medium text-fg-primary group-hover:text-accent
                                 transition-colors overflow-hidden text-ellipsis whitespace-nowrap">
                  {f.name}
                </span>
                <span className="text-xs text-fg-tertiary shrink-0 tabular-nums ml-4">
                  {formatSize(f.size)}
                </span>
                <span className="text-xs text-fg-tertiary shrink-0 tabular-nums ml-3">
                  {formatDate(f.createdAt)}
                </span>
              </a>
            )}
            <button
              onClick={() => handleDelete(f.id, f.name)}
              className="opacity-0 group-hover:opacity-100 px-3 py-1 text-xs text-fg-tertiary
                         hover:text-danger transition-all mr-2 flex-shrink-0"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
