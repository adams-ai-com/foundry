import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { generateJSON } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TextAlign from '@tiptap/extension-text-align'

export const dynamic = 'force-dynamic'

const EXTENSIONS = [
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
]

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer })
  if (messages.some((m) => m.type === 'error')) {
    return NextResponse.json({ error: 'Failed to parse docx' }, { status: 422 })
  }

  const content = generateJSON(html, EXTENSIONS)
  return NextResponse.json({ content })
}
