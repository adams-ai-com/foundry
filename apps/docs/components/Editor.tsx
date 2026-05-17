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

const AUTOSAVE_MS = 1500

export function Editor({ doc }: { doc: Document }) {
  const [title, setTitle] = useState(doc.title)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(async (newTitle: string, content: object) => {
    setSaveState('saving')
    await updateDocument(doc.id, newTitle, content)
    setSaveState('saved')
  }, [doc.id])

  const scheduleSave = useCallback((newTitle: string, content: object) => {
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
    content: Object.keys(doc.content).length ? doc.content : '<p></p>',
    editorProps: {
      attributes: {
        class: 'tiptap prose max-w-none p-12 min-h-full focus:outline-none',
      },
    },
    onUpdate({ editor }) {
      scheduleSave(title, editor.getJSON())
    },
  })

  // Save on title change (editor content stays as-is)
  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newTitle = e.target.value
    setTitle(newTitle)
    scheduleSave(newTitle, editor?.getJSON() ?? {})
  }

  // Flush save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        if (editor) save(title, editor.getJSON())
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          placeholder="Untitled"
          className="flex-1 text-lg font-semibold text-gray-800 bg-transparent border-none outline-none placeholder-gray-300"
        />
        <span className="text-xs text-gray-400 shrink-0">
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
