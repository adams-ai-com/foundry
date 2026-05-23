'use client'

import { forwardRef, useImperativeHandle } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'

export interface RichTextEditorRef {
  setContent: (html: string) => void
}

interface RichTextEditorProps {
  initialHtml?: string
  onChange: (html: string, text: string) => void
  placeholder?: string
  disabled?: boolean
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  function RichTextEditor({ initialHtml = '', onChange, placeholder, disabled }, ref) {
    const editor = useEditor({
      extensions: [
        StarterKit,
        Underline,
        Placeholder.configure({ placeholder: placeholder ?? 'Compose email' }),
      ],
      content: initialHtml || '',
      editable: !disabled,
      onUpdate: ({ editor }) => {
        const html = editor.getHTML()
        const text = editor.getText()
        onChange(html === '<p></p>' ? '' : html, text)
      },
    })

    useImperativeHandle(ref, () => ({
      setContent: (html: string) => {
        editor?.commands.setContent(html)
      },
    }), [editor])

    if (!editor) return null

    const ToolBtn = ({
      label,
      active,
      title,
      onClick,
    }: {
      label: string
      active: boolean
      title?: string
      onClick: () => void
    }) => (
      <button
        type="button"
        title={title}
        onMouseDown={(e) => {
          e.preventDefault()
          onClick()
        }}
        className={`px-2 py-0.5 text-xs rounded transition-colors ${
          active ? 'bg-gray-300 font-semibold' : 'hover:bg-gray-200 text-gray-600'
        }`}
      >
        {label}
      </button>
    )

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <ToolBtn
            label="B"
            active={editor.isActive('bold')}
            title="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolBtn
            label="I"
            active={editor.isActive('italic')}
            title="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolBtn
            label="U"
            active={editor.isActive('underline')}
            title="Underline"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <div className="w-px h-3.5 bg-gray-300 mx-1" />
          <ToolBtn
            label="• List"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolBtn
            label="1. List"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
        </div>
        <EditorContent editor={editor} className="prosemirror-compose flex-1 overflow-y-auto" />
      </div>
    )
  }
)
