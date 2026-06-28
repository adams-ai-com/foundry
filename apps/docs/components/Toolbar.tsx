'use client'

import { useState } from 'react'
import type { Editor as TipTapEditor } from '@tiptap/react'
import { IconButton, Separator } from '@owl/ui'
import { LinkPopover } from './LinkPopover'
import { ImagePopover } from './ImagePopover'

// ── Icons ────────────────────────────────────────────────────────────────────

function AlignLeftIcon()   { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M3 6h18M3 10h12M3 14h18M3 18h12"/></svg> }
function AlignCenterIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M3 6h18M6 10h12M3 14h18M6 18h12"/></svg> }
function AlignRightIcon()  { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M3 6h18M9 10h12M3 14h18M9 18h12"/></svg> }
function TableIcon()       { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg> }
function LinkIcon()        { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg> }
function ImageIcon()       { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21"/></svg> }
function RowBeforeIcon()   { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="1"/><path strokeLinecap="round" d="M12 3v6M9 6h6"/></svg> }
function RowAfterIcon()    { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="10" rx="1"/><path strokeLinecap="round" d="M12 15v6M9 18h6"/></svg> }
function ColBeforeIcon()   { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><rect x="10" y="3" width="11" height="18" rx="1"/><path strokeLinecap="round" d="M3 12h6M6 9v6"/></svg> }
function ColAfterIcon()    { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><rect x="3" y="3" width="11" height="18" rx="1"/><path strokeLinecap="round" d="M15 12h6M18 9v6"/></svg> }
function DelRowIcon()      { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1"/><path strokeLinecap="round" d="M9 12h6"/></svg> }
function DelColIcon()      { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="1"/><path strokeLinecap="round" d="M12 9v6"/></svg> }
function DelTableIcon()    { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="1"/><path strokeLinecap="round" d="M9 9l6 6m0-6l-6 6"/></svg> }

// ── Component ────────────────────────────────────────────────────────────────

interface ToolbarProps { editor: TipTapEditor | null }

export function Toolbar({ editor }: ToolbarProps) {
  const [popover, setPopover] = useState<'link' | 'image' | null>(null)

  if (!editor) return null

  const isInTable = editor.isActive('table')

  return (
    // Outer wrapper: relative so popovers can escape the overflow-x-auto inner div
    <div className="sticky top-12 z-[11] bg-bg-raised border-b border-border relative">

      {/* Transparent backdrop closes any open popover on outside click */}
      {popover && (
        <div className="fixed inset-0 z-40" onClick={() => setPopover(null)} />
      )}

      {/* ── Main toolbar row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 overflow-x-auto scrollbar-none">

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

        <IconButton label="Bold (Ctrl+B)"      active={editor.isActive('bold')}      onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong className="text-sm leading-none">B</strong>
        </IconButton>
        <IconButton label="Italic (Ctrl+I)"    active={editor.isActive('italic')}    onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em className="text-sm leading-none not-italic font-serif">I</em>
        </IconButton>
        <IconButton label="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span className="underline text-sm leading-none">U</span>
        </IconButton>
        <IconButton label="Strikethrough"       active={editor.isActive('strike')}    onClick={() => editor.chain().focus().toggleStrike().run()}>
          <span className="line-through text-sm leading-none">S</span>
        </IconButton>
        <IconButton label="Inline code"         active={editor.isActive('code')}      onClick={() => editor.chain().focus().toggleCode().run()}>
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

        <IconButton label="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
        </IconButton>
        <IconButton label="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path strokeLinecap="round" strokeLinejoin="round" d="M8 10l-2 2 2 2M16 10l2 2-2 2M11 15l2-6" strokeWidth={1.5}/></svg>
        </IconButton>

        <Separator />

        {/* Link ─ shows popover to set/update/remove href */}
        <IconButton
          label="Link (Cmd+K)"
          active={editor.isActive('link')}
          onClick={() => setPopover(p => p === 'link' ? null : 'link')}
        >
          <LinkIcon />
        </IconButton>

        {/* Image ─ shows popover to insert an image by URL */}
        <IconButton
          label="Insert image"
          onClick={() => setPopover(p => p === 'image' ? null : 'image')}
        >
          <ImageIcon />
        </IconButton>

        <Separator />

        <IconButton label="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <TableIcon />
        </IconButton>

      </div>

      {/* ── Table controls (visible only when cursor is inside a table) ── */}
      {isInTable && (
        <div className="flex items-center gap-0.5 px-3 py-1 border-t border-border/40 bg-bg-surface/70 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wide mr-1.5 shrink-0">Table</span>
          <IconButton label="Add row above"   onClick={() => editor.chain().focus().addRowBefore().run()}><RowBeforeIcon /></IconButton>
          <IconButton label="Add row below"   onClick={() => editor.chain().focus().addRowAfter().run()}><RowAfterIcon /></IconButton>
          <Separator />
          <IconButton label="Add column left"  onClick={() => editor.chain().focus().addColumnBefore().run()}><ColBeforeIcon /></IconButton>
          <IconButton label="Add column right" onClick={() => editor.chain().focus().addColumnAfter().run()}><ColAfterIcon /></IconButton>
          <Separator />
          <IconButton label="Delete row"    onClick={() => editor.chain().focus().deleteRow().run()}><DelRowIcon /></IconButton>
          <IconButton label="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}><DelColIcon /></IconButton>
          <Separator />
          <IconButton label="Delete table"  onClick={() => editor.chain().focus().deleteTable().run()}><DelTableIcon /></IconButton>
        </div>
      )}

      {/* ── Popovers — rendered outside overflow container ─────────────── */}
      {popover === 'link' && (
        <div className="relative z-50">
          <LinkPopover editor={editor} onClose={() => setPopover(null)} />
        </div>
      )}
      {popover === 'image' && (
        <div className="relative z-50">
          <ImagePopover editor={editor} onClose={() => setPopover(null)} />
        </div>
      )}

    </div>
  )
}
