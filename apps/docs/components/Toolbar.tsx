'use client'

import type { Editor as TipTapEditor } from '@tiptap/react'
import { IconButton, Separator } from '@foundry/ui'

interface ToolbarProps { editor: TipTapEditor | null }

function AlignLeftIcon()   { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M3 6h18M3 10h12M3 14h18M3 18h12"/></svg> }
function AlignCenterIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M3 6h18M6 10h12M3 14h18M6 18h12"/></svg> }
function AlignRightIcon()  { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M3 6h18M9 10h12M3 14h18M9 18h12"/></svg> }
function TableIcon()       { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg> }

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 bg-bg-raised border-b border-border sticky top-12 z-10 overflow-x-auto scrollbar-none">
      <IconButton label="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>
      </IconButton>
      <IconButton label="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3"/></svg>
      </IconButton>

      <Separator />

      <select
        title="Text style"
        aria-label="Text style"
        className="text-xs border border-border rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-accent/40 text-fg-primary bg-bg-surface cursor-pointer"
        value={
          editor.isActive('heading', { level: 1 }) ? '1' :
          editor.isActive('heading', { level: 2 }) ? '2' :
          editor.isActive('heading', { level: 3 }) ? '3' : '0'
        }
        onChange={(e) => {
          const level = parseInt(e.target.value)
          if (level === 0) editor.chain().focus().setParagraph().run()
          else editor.chain().focus().toggleHeading({ level: level as 1|2|3 }).run()
        }}
      >
        <option value="0">Paragraph</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>

      <Separator />

      <IconButton label="Bold (Ctrl+B)"        active={editor.isActive('bold')}      onClick={() => editor.chain().focus().toggleBold().run()}>
        <strong className="text-sm leading-none">B</strong>
      </IconButton>
      <IconButton label="Italic (Ctrl+I)"      active={editor.isActive('italic')}    onClick={() => editor.chain().focus().toggleItalic().run()}>
        <em className="text-sm leading-none not-italic font-serif">I</em>
      </IconButton>
      <IconButton label="Underline (Ctrl+U)"   active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline text-sm leading-none">U</span>
      </IconButton>
      <IconButton label="Strikethrough"         active={editor.isActive('strike')}    onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through text-sm leading-none">S</span>
      </IconButton>
      <IconButton label="Inline code"           active={editor.isActive('code')}      onClick={() => editor.chain().focus().toggleCode().run()}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
      </IconButton>

      <Separator />

      <IconButton label="Align left"   active={editor.isActive({ textAlign: 'left' })}   onClick={() => editor.chain().focus().setTextAlign('left').run()}>   <AlignLeftIcon /></IconButton>
      <IconButton label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}> <AlignCenterIcon /></IconButton>
      <IconButton label="Align right"  active={editor.isActive({ textAlign: 'right' })}  onClick={() => editor.chain().focus().setTextAlign('right').run()}>  <AlignRightIcon /></IconButton>

      <Separator />

      <IconButton label="Bullet list"   active={editor.isActive('bulletList')}  onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="4" cy="7" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="17" r="1.5" fill="currentColor" stroke="none"/><path strokeLinecap="round" d="M8 7h13M8 12h13M8 17h13"/></svg>
      </IconButton>
      <IconButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M10 7h11M10 12h11M10 17h11"/><path strokeLinecap="round" strokeLinejoin="round" d="M3 7h1v3M3 10h2M3 14l2-1v4H3" strokeWidth={1.5}/></svg>
      </IconButton>

      <Separator />

      <IconButton label="Blockquote"  active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
      </IconButton>
      <IconButton label="Code block"  active={editor.isActive('codeBlock')}  onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path strokeLinecap="round" strokeLinejoin="round" d="M8 10l-2 2 2 2M16 10l2 2-2 2M11 15l2-6" strokeWidth={1.5}/></svg>
      </IconButton>

      <Separator />

      <IconButton label="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <TableIcon />
      </IconButton>
    </div>
  )
}
