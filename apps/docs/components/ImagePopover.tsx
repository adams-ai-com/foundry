'use client'

import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'

interface Props {
  editor: Editor
  onClose: () => void
}

export function ImagePopover({ editor, onClose }: Props) {
  const urlRef = useRef<HTMLInputElement>(null)
  const altRef = useRef<HTMLInputElement>(null)

  useEffect(() => { urlRef.current?.focus() }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const src = urlRef.current?.value.trim() ?? ''
    if (!src) return
    const alt = altRef.current?.value.trim() ?? ''
    editor.chain().focus().setImage({ src, alt }).run()
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); onClose() }
  }

  return (
    <div
      className="absolute top-full right-4 mt-1 z-50 bg-bg-raised border border-border rounded-lg shadow-lg p-3 w-80"
      onKeyDown={handleKeyDown}
    >
      <p className="text-xs font-medium text-fg-secondary mb-2">Insert image</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          ref={urlRef}
          type="text"
          placeholder="Image URL…"
          className="text-sm border border-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent/40 bg-bg-surface text-fg-primary placeholder:text-fg-tertiary"
        />
        <input
          ref={altRef}
          type="text"
          placeholder="Alt text (optional)"
          className="text-sm border border-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent/40 bg-bg-surface text-fg-primary placeholder:text-fg-tertiary"
        />
        <button
          type="submit"
          className="text-sm bg-accent text-accent-fg px-3 py-1.5 rounded hover:bg-accent-h transition-colors font-medium"
        >
          Insert
        </button>
      </form>
    </div>
  )
}
