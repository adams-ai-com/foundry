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
import { Toolbar } from './Toolbar'
import { updateDocument } from '@/lib/actions'
import type { Document } from '@/lib/actions'

type JSONContent = Record<string, unknown>

const AUTOSAVE_MS = 1500

export function Editor({ doc }: { doc: Document }) {
  const [title, setTitle] = useState(doc.title)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref keeps onUpdate from closing over stale title state
  const titleRef = useRef(doc.title)

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
      StarterKit,
      Underline,
      TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: Object.keys(doc.content).length ? (doc.content as JSONContent) : '<p></p>',
    editorProps: {
      attributes: {
        class: 'tiptap prose max-w-none p-12 min-h-full focus:outline-none',
      },
    },
    onUpdate({ editor }) {
      // Use ref so this always has the latest title even though this callback
      // is created once at mount and never re-created by TipTap.
      scheduleSave(titleRef.current, editor.getJSON())
    },
  })

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newTitle = e.target.value
    setTitle(newTitle)
    titleRef.current = newTitle
    scheduleSave(newTitle, editor?.getJSON() ?? {})
  }

  // Flush any pending save on blur so navigating away doesn't lose title edits
  function handleTitleBlur() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
      save(titleRef.current, editor?.getJSON() ?? {})
    }
  }

  // Clean up timer on unmount
  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  return (
    <>
      {/* Header bar */}
      <div className="flex items-center gap-4 px-6 py-3 bg-white border-b border-gray-200">
        <a href="/" className="text-gray-400 hover:text-gray-600 text-sm shrink-0">← Docs</a>
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          onBlur={handleTitleBlur}
          placeholder="Untitled"
          data-testid="doc-title"
          className="flex-1 text-lg font-semibold text-gray-800 bg-transparent border-none outline-none placeholder-gray-300"
        />
        <span className="text-xs text-gray-400 shrink-0" data-testid="save-state">
          {saveState === 'saving' ? 'Saving…' : saveState === 'unsaved' ? 'Unsaved' : 'Saved'}
        </span>
      </div>

      <Toolbar editor={editor} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[816px] min-h-[1056px] mx-auto my-8 bg-white shadow-sm border border-gray-200 rounded">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>
    </>
  )
}
