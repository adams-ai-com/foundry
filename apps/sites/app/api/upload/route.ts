import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import sql from '@/lib/db'

const UPLOAD_DIR = process.env.OWL_UPLOAD_DIR ?? './data/uploads/sites'
const MAX_BYTES  = 100 * 1024 * 1024  // 100 MB

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const siteId   = formData.get('siteId')   as string | null
  const folderId = formData.get('folderId') as string | null
  const file     = formData.get('file')     as File   | null

  if (!file || !siteId) {
    return NextResponse.json({ error: 'siteId and file are required' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 413 })
  }

  const id          = randomUUID()
  const storagePath = join(UPLOAD_DIR, id)

  await mkdir(UPLOAD_DIR, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(storagePath, buffer)

  await sql`
    INSERT INTO site_files (id, site_id, folder_id, name, mime_type, size, storage_path)
    VALUES (
      ${id},
      ${siteId},
      ${folderId ?? null},
      ${file.name},
      ${file.type || 'application/octet-stream'},
      ${file.size},
      ${storagePath}
    )`

  return NextResponse.json({ id, name: file.name })
}
