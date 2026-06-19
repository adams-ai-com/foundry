'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { listFiles, uploadFile, deleteFile, downloadFileUrl, type FileItem } from '../lib/api'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(contentType: string): string {
  if (contentType.startsWith('image/')) return '🖼'
  if (contentType === 'application/pdf') return '📄'
  if (contentType.includes('word') || contentType.includes('document')) return '📝'
  if (contentType.includes('sheet') || contentType.includes('excel') || contentType.includes('csv')) return '📊'
  if (contentType.includes('zip') || contentType.includes('tar') || contentType.includes('gzip')) return '📦'
  if (contentType.startsWith('text/')) return '📃'
  if (contentType.startsWith('video/')) return '🎬'
  if (contentType.startsWith('audio/')) return '🎵'
  return '📎'
}

export function FilesView() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [openingPdf, setOpeningPdf] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function openInFoundryPdf(id: string, filename: string) {
    setOpeningPdf(id)
    try {
      const res = await fetch(downloadFileUrl(id))
      if (!res.ok) throw new Error('Could not fetch file')
      const blob = await res.blob()
      const form = new FormData()
      form.append('file', new File([blob], filename, { type: 'application/pdf' }))
      const up = await fetch('/pdf/api/pdf/upload', { method: 'POST', body: form })
      if (!up.ok) throw new Error('Upload failed')
      const { jobId } = await up.json()
      window.open(`/pdf/viewer/${jobId}`, '_blank')
    } catch (e) {
      alert('Could not open PDF: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setOpeningPdf(null)
    }
  }

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const result = await listFiles({ search: q })
      setFiles(result.files)
      setTotal(result.total)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setSearch(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => load(q || undefined), 300)
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList?.length) return
    setUploading(true)
    try {
      for (const f of Array.from(fileList)) {
        await uploadFile(f)
      }
      load(search || undefined)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteFile(id)
    setFiles((prev) => prev.filter((f) => f.id !== id))
    setTotal((n) => n - 1)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    handleUpload(e.dataTransfer.files)
  }

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Files</h2>
          {total > 0 && <p className="text-xs text-gray-500 mt-0.5">{total} file{total !== 1 ? 's' : ''}</p>}
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1 rounded"
        >
          {uploading ? 'Uploading…' : '+ Upload'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-gray-800">
        <input
          value={search}
          onChange={handleSearchChange}
          placeholder="Search files…"
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Drop zone overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-blue-900/40 border-2 border-dashed border-blue-400 z-10 flex items-center justify-center pointer-events-none">
          <span className="text-blue-300 text-lg font-medium">Drop files to upload</span>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-gray-500 text-sm">Loading…</div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-3xl mb-3">📁</div>
            <div className="text-gray-500 text-sm mb-1">
              {search ? 'No files match your search' : 'No files yet'}
            </div>
            {!search && (
              <div className="text-gray-600 text-xs">
                Upload files directly, or send an email with attachments — they'll appear here automatically.
              </div>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-500 font-medium px-4 py-2">Name</th>
                <th className="text-left text-xs text-gray-500 font-medium px-4 py-2 hidden sm:table-cell">Type</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-2">Size</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-2 hidden sm:table-cell">Added</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {files.map((file) => (
                <tr key={file.id} className="hover:bg-gray-800/40 group">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base flex-shrink-0">{fileIcon(file.contentType)}</span>
                      <div className="min-w-0">
                        {file.contentType === 'application/pdf' ? (
                          <button
                            onClick={() => openInFoundryPdf(file.id, file.filename)}
                            disabled={openingPdf === file.id}
                            className="text-sm text-gray-200 hover:text-blue-300 truncate block max-w-xs text-left disabled:opacity-50"
                          >
                            {openingPdf === file.id ? 'Opening…' : file.filename}
                          </button>
                        ) : (
                          <a
                            href={downloadFileUrl(file.id)}
                            download={file.filename}
                            className="text-sm text-gray-200 hover:text-blue-300 truncate block max-w-xs"
                          >
                            {file.filename}
                          </a>
                        )}
                        {file.messageId && (
                          <span className="text-xs text-gray-500">from email</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    <span className="text-xs text-gray-500">{file.contentType.split('/')[1] ?? file.contentType}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-xs text-gray-400">{formatBytes(file.size)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right hidden sm:table-cell">
                    <span className="text-xs text-gray-500">
                      {new Date(file.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="text-xs text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 px-1"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
