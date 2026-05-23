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
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { updatePage, deletePage } from '@/lib/actions'
import type { SitePage } from '@/lib/actions'

type JSONContent = Record<string, unknown>
const AUTOSAVE_MS = 1500

export function PageEditor({ page, siteSlug }: { page: SitePage; siteSlug: string }) {
  const [title, setTitle]         = useState(page.title)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(async (newTitle: string, content: JSONContent) => {
    setSaveState('saving')
    await updatePage(page.id, newTitle, content)
    setSaveState('saved')
  }, [page.id])

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
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content: page.content && Object.keys(page.content as object).length > 0
      ? page.content as JSONContent
      : undefined,
    onUpdate: ({ editor }) => {
      scheduleSave(title, editor.getJSON() as JSONContent)
    },
  })

  const titleRef = useRef(title)
  titleRef.current = title

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newTitle = e.target.value
    setTitle(newTitle)
    if (editor) scheduleSave(newTitle, editor.getJSON() as JSONContent)
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        if (editor) save(titleRef.current, editor.getJSON() as JSONContent)
      }
    }
  }, [editor, save])

  async function handleDelete() {
    if (!confirm(`Delete "${title}"?`)) return
    await deletePage(page.id, siteSlug, page.folderId)
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-base overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-border px-4 py-2 flex items-center gap-0.5 flex-wrap bg-bg-raised flex-shrink-0">
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold"><strong>B</strong></ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic" cls="italic">I</ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="Underline" cls="underline">U</ToolbarBtn>
        <Sep />
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="H1">H1</ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="H2">H2</ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive('heading', { level: 3 })} title="H3">H3</ToolbarBtn>
        <Sep />
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet list">•</ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Ordered list">1.</ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleTaskList().run()} active={editor?.isActive('taskList')} title="Task list">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
        </ToolbarBtn>
        <Sep />
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Quote">"</ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleCode().run()} active={editor?.isActive('code')} title="Inline code" cls="font-mono">{`<>`}</ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive('codeBlock')} title="Code block" cls="font-mono text-xs">```</ToolbarBtn>
        <Sep />
        <ToolbarBtn
          onClick={() => { const url = prompt('URL:'); if (url) editor?.chain().focus().setLink({ href: url }).run() }}
          active={editor?.isActive('link')} title="Link"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="Divider">—</ToolbarBtn>

        <div className="flex-1" />
        <span className={`text-xs transition-colors mr-2 ${
          saveState === 'saving'  ? 'text-amber-500' :
          saveState === 'unsaved' ? 'text-fg-tertiary' :
          'text-fg-tertiary/40'
        }`}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'unsaved' ? 'Unsaved' : 'Saved'}
        </span>
        <button
          onClick={handleDelete}
          className="text-xs text-fg-tertiary hover:text-danger transition-colors px-2 py-1 rounded hover:bg-bg-hover"
        >
          Delete
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-10">
          <input
            value={title}
            onChange={handleTitleChange}
            placeholder="Page title"
            className="w-full text-4xl font-bold text-fg-primary placeholder:text-fg-tertiary/40
                       border-none outline-none mb-6 bg-transparent"
          />
          <EditorContent editor={editor} className="tiptap" />
        </div>
      </div>
    </div>
  )
}

function Sep() {
  return <div className="w-px h-4 bg-border mx-1 flex-shrink-0" />
}

function ToolbarBtn({
  onClick, active, title, children, cls = '',
}: {
  onClick?: () => void
  active?: boolean
  title?: string
  children: React.ReactNode
  cls?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${cls} ${
        active
          ? 'bg-bg-active text-accent'
          : 'text-fg-secondary hover:bg-bg-hover hover:text-fg-primary'
      }`}
    >
      {children}
    </button>
  )
}
