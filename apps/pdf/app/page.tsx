'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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

function FileIcon({ size = 5 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={`w-${size} h-${size} text-accent/60`}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function timeAgo(ts: number): string {
  const s = Math.floor(Date.now() / 1000 - ts)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return new Date(ts * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function PdfHome() {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Batch state — lifted here so it can reset when files change
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [files, setFiles] = useState<{ jobId: string; filename: string; size: number; createdAt: number }[]>([])
  const [filesLoaded, setFilesLoaded] = useState(false)

  const loadFiles = useCallback(async () => {
    const res = await fetch('/pdf/api/pdf/list').catch(() => null)
    if (res?.ok) { const d = await res.json(); setFiles(d.files ?? []) }
    setFilesLoaded(true)
  }, [])

  useEffect(() => { loadFiles() }, [loadFiles])

  async function upload(file: File) {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported for the main upload zone.'); return
    }
    setError(null); setUploading(true)
    try {
      const form = new FormData(); form.append('file', file)
      const res = await fetch('/pdf/api/pdf/upload', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      const { jobId } = await res.json()
      router.push(`/pdf/editor/${jobId}`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); setUploading(false) }
  }

  async function importOffice(file: File) {
    setError(null); setImporting(true)
    try {
      const form = new FormData(); form.append('file', file)
      const res = await fetch('/pdf/api/pdf/convert/import', { method: 'POST', body: form })
      if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Import failed' })); throw new Error(err.error ?? 'Import failed') }
      const { jobId } = await res.json()
      router.push(`/pdf/editor/${jobId}`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Import failed'); setImporting(false) }
  }

  function onDrop(e: React.DragEvent) { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) upload(file) }
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (file) upload(file) }
  function onImportChange(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (file) importOffice(file) }

  const busy = uploading || importing
  const filtered = search ? files.filter(f => f.filename.toLowerCase().includes(search.toLowerCase())) : files

  return (
    <div className="max-w-2xl w-full mx-auto px-6 py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg-primary">Foundry PDF</h1>
          <p className="text-sm text-fg-tertiary mt-1">Upload a PDF to edit, create forms, convert, redact, or send for signing.</p>
        </div>
        <a href="/pdf/envelopes"
          className="flex items-center gap-1.5 text-sm font-medium text-fg-secondary hover:text-accent border border-border rounded-lg px-3 py-1.5 hover:border-accent/40 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
            <line x1="12" y1="12" x2="12" y2="18"/>
          </svg>
          Envelopes
        </a>
      </div>

      {/* Drop zone */}
      <div
        className={`rounded-2xl border-2 border-dashed transition-colors cursor-pointer
          flex flex-col items-center justify-center gap-4 py-16 px-8
          ${dragging ? 'border-accent bg-bg-active' : 'border-border bg-bg-surface hover:border-accent/40 hover:bg-bg-hover'}
          ${busy ? 'pointer-events-none opacity-60' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}>
        <div className="w-16 h-16 rounded-xl bg-bg-raised border border-border flex items-center justify-center">
          {uploading ? <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /> : <UploadIcon />}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-fg-primary">{uploading ? 'Uploading…' : 'Drop a PDF here, or click to browse'}</p>
          <p className="text-xs text-fg-tertiary mt-1">PDF files only</p>
        </div>
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onFileChange} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-fg-tertiary">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <button disabled={busy} onClick={() => !busy && importRef.current?.click()}
        className="mt-4 w-full rounded-xl border border-border bg-bg-surface hover:bg-bg-hover transition-colors px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium text-fg-secondary disabled:opacity-50 disabled:cursor-not-allowed">
        {importing ? <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /> : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-fg-tertiary">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <path d="M12 18v-6M9 15l3 3 3-3"/>
          </svg>
        )}
        {importing ? 'Converting…' : 'Import DOCX / XLSX / PPTX → PDF'}
        <input ref={importRef} type="file" accept=".docx,.xlsx,.pptx,.odt,.ods,.odp,.doc,.xls,.ppt" className="hidden" onChange={onImportChange} />
      </button>

      {error && <p className="mt-4 text-sm text-danger bg-danger/10 rounded-lg px-4 py-2">{error}</p>}

      {/* File list */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-3">
          <input type="checkbox"
            checked={filtered.length > 0 && filtered.every(f => selected.has(f.jobId))}
            ref={el => { if (el) el.indeterminate = selected.size > 0 && !filtered.every(f => selected.has(f.jobId)) }}
            onChange={e => {
              if (e.target.checked) setSelected(new Set(filtered.map(f => f.jobId)))
              else setSelected(new Set())
            }}
            className="accent-accent shrink-0 cursor-pointer" />
          <FileIcon />
          <h2 className="text-sm font-semibold text-fg-primary">Recent files</h2>
          {selected.size > 0 && (
            <span className="text-xs bg-accent text-accent-fg rounded-full px-2 py-0.5 font-medium">
              {selected.size} selected
            </span>
          )}
          <div className="flex-1" />
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="text-xs text-fg-tertiary hover:text-fg-primary">
              Deselect all
            </button>
          )}
          <input type="search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-40 border border-border rounded-lg px-3 py-1 text-xs bg-bg-surface text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-1 focus:ring-accent" />
        </div>

        {!filesLoaded && <div className="text-xs text-fg-tertiary">Loading…</div>}
        {filesLoaded && filtered.length === 0 && (
          <p className="text-xs text-fg-tertiary">
            {search ? `No files matching "${search}".` : 'No recent files. Upload a PDF to get started.'}
          </p>
        )}
        {filesLoaded && filtered.length > 0 && (
          <ul className="divide-y divide-border rounded-xl border border-border bg-bg-raised overflow-hidden">
            {filtered.map(f => {
              const isSel = selected.has(f.jobId)
              return (
                <li key={f.jobId} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isSel ? 'bg-accent/5' : 'hover:bg-bg-hover'}`}>
                  <input type="checkbox" checked={isSel} onChange={e => {
                    setSelected(prev => {
                      const next = new Set(prev)
                      e.target.checked ? next.add(f.jobId) : next.delete(f.jobId)
                      return next
                    })
                  }} className="accent-accent shrink-0 cursor-pointer" />
                  <a href={`/pdf/editor/${f.jobId}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-bg-surface border border-border flex items-center justify-center shrink-0">
                      <FileIcon size={4} />
                    </div>
                    <span className="flex-1 text-sm text-fg-primary truncate">{f.filename}</span>
                  </a>
                  <span className="text-xs text-fg-tertiary shrink-0 tabular-nums">{timeAgo(f.createdAt)}</span>
                  <span className="text-xs text-fg-tertiary shrink-0">{formatBytes(f.size)}</span>
                  <a href={`/pdf/api/pdf/${f.jobId}/download`} title="Download"
                    className="text-fg-tertiary hover:text-fg-primary shrink-0" onClick={e => e.stopPropagation()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                  </a>
                  <a href={`/pdf/editor/${f.jobId}?sign=1`} title="Send for signing"
                    className="text-fg-tertiary hover:text-accent shrink-0" onClick={e => e.stopPropagation()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M12 20h9"/>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <BatchBar
          selected={selected}
          files={files}
          onDone={() => { setSelected(new Set()); loadFiles() }}
        />
      )}
    </div>
  )
}

// ── Batch action bar ──────────────────────────────────────────────────────────

function BatchBar({ selected, files, onDone }: {
  selected: Set<string>
  files: { jobId: string; filename: string }[]
  onDone: () => void
}) {
  const [wmOpen, setWmOpen]   = useState(false)
  const [wmText, setWmText]   = useState('CONFIDENTIAL')
  const [wmOpacity, setWmOpacity] = useState(30)
  const [wmAngle, setWmAngle] = useState(45)
  const [wmColor, setWmColor] = useState('#aaaaaa')
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState('')

  const selectedFiles = files.filter(f => selected.has(f.jobId))

  async function batchWatermark() {
    setWorking(true)
    for (let i = 0; i < selectedFiles.length; i++) {
      const f = selectedFiles[i]
      setProgress(`Watermarking ${i + 1} / ${selectedFiles.length}…`)
      await fetch(`/pdf/api/pdf/${f.jobId}/watermark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: wmText, opacity: wmOpacity / 100, angle: wmAngle, color: wmColor, pages: 'all' }),
      })
    }
    setWorking(false); setProgress(''); setWmOpen(false); onDone()
  }

  async function batchDownload() {
    for (const f of selectedFiles) {
      const a = document.createElement('a')
      a.href = `/pdf/api/pdf/${f.jobId}/download`
      a.download = f.filename
      a.click()
      await new Promise(r => setTimeout(r, 400))
    }
  }

  async function batchOcr() {
    setWorking(true)
    for (let i = 0; i < selectedFiles.length; i++) {
      setProgress(`OCR ${i + 1} / ${selectedFiles.length}…`)
      await fetch(`/pdf/api/pdf/${selectedFiles[i].jobId}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: 'eng' }),
      })
    }
    setWorking(false); setProgress(''); onDone()
  }

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-bg-raised border border-border rounded-2xl shadow-card px-5 py-3 flex items-center gap-4 text-sm">
        <span className="text-fg-secondary font-medium">{selected.size} file{selected.size !== 1 ? 's' : ''} selected</span>
        <div className="w-px h-5 bg-border" />
        <button onClick={batchDownload} disabled={working}
          className="text-fg-secondary hover:text-fg-primary flex items-center gap-1.5 disabled:opacity-40">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          Download all
        </button>
        <button onClick={() => setWmOpen(true)} disabled={working}
          className="text-fg-secondary hover:text-fg-primary flex items-center gap-1.5 disabled:opacity-40">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Watermark
        </button>
        <button onClick={batchOcr} disabled={working}
          className="text-fg-secondary hover:text-fg-primary flex items-center gap-1.5 disabled:opacity-40">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h2m2 0h2m2 0h2"/>
          </svg>
          Make searchable
        </button>
        {working && <span className="text-xs text-fg-tertiary animate-pulse">{progress}</span>}
      </div>

      {/* Watermark modal */}
      {wmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-bg-raised rounded-xl border border-border shadow-card p-6 w-96">
            <h2 className="text-sm font-semibold text-fg-primary mb-1">Batch Watermark</h2>
            <p className="text-xs text-fg-tertiary mb-4">Apply to {selected.size} file{selected.size !== 1 ? 's' : ''}. This permanently modifies each document.</p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-fg-tertiary">Text</span>
                <input value={wmText} onChange={e => setWmText(e.target.value)}
                  className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary" />
              </label>
              <div className="flex gap-3">
                <label className="flex-1">
                  <span className="text-xs text-fg-tertiary">Opacity — {wmOpacity}%</span>
                  <input type="range" min={5} max={80} value={wmOpacity} onChange={e => setWmOpacity(Number(e.target.value))} className="mt-1 w-full accent-accent" />
                </label>
                <label className="flex-1">
                  <span className="text-xs text-fg-tertiary">Angle — {wmAngle}°</span>
                  <input type="range" min={0} max={90} value={wmAngle} onChange={e => setWmAngle(Number(e.target.value))} className="mt-1 w-full accent-accent" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-fg-tertiary">Color</span>
                <input type="color" value={wmColor} onChange={e => setWmColor(e.target.value)}
                  className="mt-0.5 h-8 w-14 rounded border border-border cursor-pointer bg-transparent" />
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setWmOpen(false)} className="flex-1 text-sm text-fg-secondary border border-border rounded-lg py-2 hover:bg-bg-hover">Cancel</button>
              <button onClick={batchWatermark} disabled={working || !wmText.trim()}
                className="flex-1 bg-accent text-accent-fg text-sm rounded-lg py-2 hover:bg-accent-h disabled:opacity-40">
                {working ? progress || 'Working…' : `Apply to ${selected.size} file${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
