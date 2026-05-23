'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

function UploadIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}

type UploadEntry = { name: string; done: boolean; error?: string }

export function FileUpload({
  siteId,
  folderId,
}: {
  siteId: string
  folderId: string | null
}) {
  const [dragging, setDragging]   = useState(false)
  const [uploads, setUploads]     = useState<UploadEntry[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  async function uploadOne(file: File) {
    setUploads(prev => [...prev, { name: file.name, done: false }])

    const form = new FormData()
    form.append('siteId', siteId)
    if (folderId) form.append('folderId', folderId)
    form.append('file', file)

    try {
      const res = await fetch('/sites/api/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || `Upload failed (${res.status})`)
      }
      setUploads(prev => prev.map(u => u.name === file.name ? { ...u, done: true } : u))
      router.refresh()
      setTimeout(() => setUploads(prev => prev.filter(u => u.name !== file.name)), 2500)
    } catch (e) {
      setUploads(prev => prev.map(u => u.name === file.name
        ? { ...u, done: false, error: (e as Error).message }
        : u))
    }
  }

  function handleFiles(list: FileList) {
    Array.from(list).forEach(uploadOne)
  }

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true) }, [])
  const onDragLeave = useCallback(() => setDragging(false), [])
  const onDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, folderId])

  return (
    <div className="space-y-2">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer
                    transition-all select-none ${
          dragging
            ? 'border-accent bg-accent/5 text-accent'
            : 'border-border hover:border-accent/40 hover:bg-bg-hover text-fg-tertiary'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
        <UploadIcon className="w-5 h-5 mx-auto mb-1.5 opacity-60" />
        <p className="text-sm font-medium">Drop files here or click to upload</p>
        <p className="text-xs mt-0.5 opacity-60">Any file type · up to 100 MB each</p>
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-1">
          {uploads.map((u, i) => (
            <li key={i}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-surface border border-border text-sm">
              <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-fg-secondary">
                {u.name}
              </span>
              {u.error
                ? <span className="text-xs text-danger flex-shrink-0">{u.error}</span>
                : u.done
                ? <span className="text-xs text-accent flex-shrink-0">Uploaded</span>
                : <span className="text-xs text-fg-tertiary flex-shrink-0 animate-pulse">Uploading…</span>
              }
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
