'use client'

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

export function Editor() {
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
    content: '<p>Start writing…</p>',
    editorProps: {
      attributes: {
        class: 'tiptap prose max-w-none p-12 min-h-full focus:outline-none',
      },
    },
  })

  return (
    <>
      <Toolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[816px] min-h-[1056px] mx-auto my-8 bg-white shadow-sm border border-gray-200 rounded">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>
    </>
  )
}
