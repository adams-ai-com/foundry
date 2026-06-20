'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'

interface Match { from: number; to: number }

function findInDoc(editor: Editor, query: string): Match[] {
  if (!query.trim()) return []
  const matches: Match[] = []
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  editor.state.doc.nodesBetween(0, editor.state.doc.content.size, (node, pos) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n = node as any
    if (!n.isText || !n.text) return
    const re = new RegExp(escaped, 'gi')
    let m
    while ((m = re.exec(n.text)) !== null) {
      matches.push({ from: pos + m.index, to: pos + m.index + m[0].length })
    }
  })
  return matches
}

interface Props {
  editor: Editor | null
  onClose: () => void
}

export function FindBar({ editor, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  // Keep a ref so callbacks always see fresh state
  const matchesRef = useRef<Match[]>([])
  const activeRef = useRef(0)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Recompute matches when query or doc changes
  const recompute = useCallback((q: string) => {
    if (!editor) return
    const m = findInDoc(editor, q)
    matchesRef.current = m
    setMatches(m)
    setActiveIndex(0)
    activeRef.current = 0
  }, [editor])

  useEffect(() => { recompute(query) }, [query, recompute])

  // Recompute when editor content changes
  useEffect(() => {
    if (!editor) return
    const handler = () => recompute(query)
    editor.on('update', handler)
    return () => editor.off('update', handler)
  }, [editor, query, recompute])

  function jumpTo(index: number) {
    const m = matchesRef.current
    if (!m.length || !editor) return
    const i = ((index % m.length) + m.length) % m.length
    activeRef.current = i
    setActiveIndex(i)
    editor.chain().focus().setTextSelection({ from: m[i].from, to: m[i].to }).run()
    requestAnimationFrame(() => {
      editor.view.dom.ownerDocument.getSelection()?.getRangeAt(0)
        ?.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }

  function next() { jumpTo(activeRef.current + 1) }
  function prev() { jumpTo(activeRef.current - 1) }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? prev() : next() }
  }

  const count = matches.length
  const label = !query ? '' : count === 0 ? 'No results' : `${activeIndex + 1} of ${count}`

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 bg-bg-raised border-b border-border shrink-0"
      role="search"
      aria-label="Find in document"
    >
      <svg className="w-3.5 h-3.5 text-fg-tertiary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in document…"
        className="flex-1 text-sm bg-transparent border-none outline-none text-fg-primary placeholder:text-fg-tertiary min-w-0"
      />
      {label && (
        <span className={`text-xs tabular-nums shrink-0 ${count === 0 ? 'text-danger' : 'text-fg-tertiary'}`}>
          {label}
        </span>
      )}
      <button
        onClick={prev}
        disabled={count === 0}
        title="Previous (Shift+Enter)"
        className="p-1 rounded text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover transition-colors disabled:opacity-30"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/>
        </svg>
      </button>
      <button
        onClick={next}
        disabled={count === 0}
        title="Next (Enter)"
        className="p-1 rounded text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover transition-colors disabled:opacity-30"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      <div className="w-px h-4 bg-border shrink-0" />
      <button
        onClick={onClose}
        title="Close (Esc)"
        className="p-1 rounded text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}
