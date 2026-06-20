'use client'

import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'

interface Props {
  editor: Editor
  onClose: () => void
}

export function LinkPopover({ editor, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const existing = editor.getAttributes('link').href as string | undefined

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.value = existing ?? ''
    input.focus()
    input.select()
  }, [existing])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const raw = inputRef.current?.value.trim() ?? ''
    if (!raw) return
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    editor.chain().focus().setLink({ href }).run()
    onClose()
  }

  function handleUnlink() {
    editor.chain().focus().unsetLink().run()
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); onClose() }
  }

  return (
    <div
      className="absolute top-full left-4 mt-1 z-50 bg-bg-raised border border-border rounded-lg shadow-lg p-3 w-80"
      onKeyDown={handleKeyDown}
    >
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="https://…"
          className="flex-1 text-sm border border-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent/40 bg-bg-surface text-fg-primary placeholder:text-fg-tertiary min-w-0"
        />
        <button
          type="submit"
          className="shrink-0 text-sm bg-accent text-accent-fg px-3 py-1.5 rounded hover:bg-accent-h transition-colors font-medium"
        >
          {existing ? 'Update' : 'Set link'}
        </button>
      </form>
      {existing && (
        <button
          type="button"
          onClick={handleUnlink}
          className="mt-2 text-xs text-fg-tertiary hover:text-danger transition-colors"
        >
          Remove link
        </button>
      )}
    </div>
  )
}
