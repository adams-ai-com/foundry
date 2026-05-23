'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-accent/50">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-accent/60">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}

export default function PdfHome() {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function upload(file: File) {
    if (!file.type.includes('pdf')) {
      setError('Only PDF files are supported.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/pdf/api/pdf/upload', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      const { jobId } = await res.json()
      router.push(`/pdf/editor/${jobId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload(file)
  }

  return (
    <div className="max-w-2xl w-full mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-fg-primary">Foundry PDF</h1>
        <p className="text-sm text-fg-tertiary mt-1">
          Upload a PDF to view, edit, create forms, convert, or redact.
        </p>
      </div>

      <div
        className={`rounded-2xl border-2 border-dashed transition-colors cursor-pointer
          flex flex-col items-center justify-center gap-4 py-16 px-8
          ${dragging
            ? 'border-accent bg-bg-active'
            : 'border-border bg-bg-surface hover:border-accent/40 hover:bg-bg-hover'
          }
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <div className="w-16 h-16 rounded-xl bg-bg-raised border border-border flex items-center justify-center">
          {uploading ? (
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          ) : (
            <UploadIcon />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-fg-primary">
            {uploading ? 'Uploading…' : 'Drop a PDF here, or click to browse'}
          </p>
          <p className="text-xs text-fg-tertiary mt-1">PDF files only</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {error && (
        <p className="mt-4 text-sm text-danger bg-danger/10 rounded-lg px-4 py-2">{error}</p>
      )}

      <div className="mt-10">
        <div className="flex items-center gap-3 mb-4">
          <FileIcon />
          <h2 className="text-sm font-semibold text-fg-primary">Recent files</h2>
        </div>
        <RecentFiles />
      </div>
    </div>
  )
}

function RecentFiles() {
  const [files, setFiles] = useState<{ jobId: string; filename: string; size: number; createdAt: string }[]>([])
  const [loaded, setLoaded] = useState(false)

  if (!loaded) {
    fetch('/pdf/api/pdf/list')
      .then(r => r.json())
      .then(d => { setFiles(d.files ?? []); setLoaded(true) })
      .catch(() => setLoaded(true))
    return (
      <div className="text-xs text-fg-tertiary">Loading…</div>
    )
  }

  if (files.length === 0) {
    return <p className="text-xs text-fg-tertiary">No recent files. Upload a PDF to get started.</p>
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-bg-raised overflow-hidden">
      {files.map(f => (
        <li key={f.jobId}>
          <a
            href={`/pdf/editor/${f.jobId}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors"
          >
            <div className="w-7 h-7 rounded-md bg-bg-surface border border-border flex items-center justify-center shrink-0">
              <FileIcon />
            </div>
            <span className="flex-1 text-sm text-fg-primary truncate">{f.filename}</span>
            <span className="text-xs text-fg-tertiary shrink-0">{formatBytes(f.size)}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}
