'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Placeholder from '@tiptap/extension-placeholder'
import { Toolbar } from './Toolbar'
import { VersionHistory } from './VersionHistory'
import { Comments } from './Comments'
import { updateDocument, deleteDocument } from '@/lib/actions'
import type { Document } from '@/lib/actions'

type JSONContent = Record<string, unknown>
const AUTOSAVE_MS = 1500

function isDocEmpty(title: string, content: JSONContent): boolean {
  if (title !== 'Untitled' && title !== '') return false
  const nodes = (content as { content?: unknown[] }).content
  if (!nodes || nodes.length === 0) return true
  if (nodes.length === 1) {
    const node = nodes[0] as { type?: string; content?: unknown[] }
    return node.type === 'paragraph' && (!node.content || node.content.length === 0)
  }
  return false
}

export function Editor({ doc }: { doc: Document }) {
  const [title, setTitle] = useState(doc.title)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [showHistory, setShowHistory] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [importing, setImporting] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleRef = useRef(doc.title)
  const importRef = useRef<HTMLInputElement>(null)

  const save = useCallback(async (newTitle: string, content: JSONContent) => {
    setSaveState('saving')
    await updateDocument(doc.id, newTitle, content)
    setSaveState('saved')
  }, [doc.id])

  const scheduleSave = useCallback((newTitle: string, content: JSONContent) => {
    setSaveState('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(newTitle, content), AUTOSAVE_MS)
  }, [save])

  const editor = useEditor({
    extensions: [
      StarterKit, Underline, TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      Image,
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content: Object.keys(doc.content).length ? (doc.content as JSONContent) : '',
    editorProps: {
      attributes: { class: 'tiptap prose max-w-none p-12 min-h-full focus:outline-none' },
    },
    onUpdate({ editor }) {
      scheduleSave(titleRef.current, editor.getJSON())
    },
  })

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newTitle = e.target.value
    setTitle(newTitle)
    titleRef.current = newTitle
    scheduleSave(newTitle, editor?.getJSON() ?? {})
  }

  function handleTitleBlur() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
      save(titleRef.current, editor?.getJSON() ?? {})
    }
  }

  async function handleBack() {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const content = editor?.getJSON() ?? {}
    if (isDocEmpty(titleRef.current, content)) { await deleteDocument(doc.id); return }
    await save(titleRef.current, content)
    window.location.href = '/docs'
  }

  function handleRestore(content: object, restoredTitle: string) {
    setTitle(restoredTitle)
    titleRef.current = restoredTitle
    editor?.commands.setContent(content as JSONContent)
    scheduleSave(restoredTitle, content as JSONContent)
    setShowHistory(false)
  }

  async function handleSaveNamed(label: string) {
    await fetch(`/docs/api/versions/${doc.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/docs/api/import', { method: 'POST', body: fd })
    if (res.ok) {
      const { content, title: importedTitle } = await res.json()
      const newTitle = importedTitle || file.name.replace(/\.docx$/, '')
      setTitle(newTitle)
      titleRef.current = newTitle
      editor?.commands.setContent(content)
      scheduleSave(newTitle, content)
    }
    setImporting(false)
    if (importRef.current) importRef.current.value = ''
  }

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  const saveIndicator =
    saveState === 'saving'  ? { dot: 'bg-amber-400 animate-pulse', text: 'Saving…',  color: 'text-fg-tertiary' } :
    saveState === 'unsaved' ? { dot: 'bg-amber-400',               text: 'Unsaved',  color: 'text-amber-500' } :
                              { dot: 'bg-emerald-500',             text: 'Saved',    color: 'text-fg-tertiary' }

  const panelBtn = (active: boolean) =>
    `p-1.5 rounded transition-colors ${active ? 'bg-bg-active text-accent' : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover'}`

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-bg-raised border-b border-border shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-fg-secondary hover:text-fg-primary text-sm font-medium transition-colors shrink-0 group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Docs
        </button>
        <div className="w-px h-4 bg-border shrink-0" />
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          onBlur={handleTitleBlur}
          placeholder="Untitled"
          data-testid="doc-title"
          className="flex-1 text-sm font-semibold text-fg-primary bg-transparent border-none outline-none placeholder:text-fg-tertiary min-w-0"
        />
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-1.5 mr-2" data-testid="save-state">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${saveIndicator.dot}`} />
            <span className={`text-xs ${saveIndicator.color} hidden sm:block`}>{saveIndicator.text}</span>
          </div>

          <input ref={importRef} type="file" accept=".docx" className="hidden" onChange={handleImport} />
          <button
            title="Import .docx"
            disabled={importing}
            onClick={() => importRef.current?.click()}
            className="text-xs text-fg-secondary hover:text-fg-primary px-2.5 py-1.5 rounded hover:bg-bg-hover transition-colors font-medium disabled:opacity-50"
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
          <a
            href={`/docs/api/export/${doc.id}`}
            download
            className="text-xs text-fg-secondary hover:text-fg-primary px-2.5 py-1.5 rounded hover:bg-bg-hover transition-colors font-medium"
          >
            Export
          </a>

          <div className="w-px h-4 bg-border mx-1" />

          <button title="Comments" onClick={() => { setShowComments(v => !v); setShowHistory(false) }} className={panelBtn(showComments)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          </button>
          <button title="Version history" onClick={() => { setShowHistory(v => !v); setShowComments(false) }} className={panelBtn(showHistory)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </button>
        </div>
      </div>

      <Toolbar editor={editor} />

      {/* Canvas */}
      <div className="flex-1 overflow-y-auto bg-bg-surface">
        <div className="max-w-[816px] mx-auto my-8 mb-16 bg-bg-raised shadow-card border border-border rounded-sm min-h-[calc(100vh-180px)]">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>

      {showHistory && (
        <VersionHistory
          documentId={doc.id}
          currentTitle={title}
          onClose={() => setShowHistory(false)}
          onRestore={handleRestore}
          onSaveNamed={handleSaveNamed}
        />
      )}
      {showComments && (
        <Comments documentId={doc.id} onClose={() => setShowComments(false)} />
      )}
    </>
  )
}
