'use server'

import { revalidatePath } from 'next/cache'
import sql from './db'

export type CRStatus = 'backlog' | 'up_next' | 'in_progress' | 'in_review' | 'blocked' | 'done'
export type CRPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface CR {
  id: string
  title: string
  description: string | null
  status: CRStatus
  priority: CRPriority
  assigned_to: string | null
  submitted_by: string | null
  labels: string[]
  created_at: string
  updated_at: string
}

export interface CRNote {
  id: string
  cr_id: string
  author: string | null
  body: string
  created_at: string
}

export interface CRAttachmentMeta {
  id: string
  cr_id: string
  filename: string
  mime_type: string
  byte_size: number
  submitted_by: string | null
  created_at: string
}

export const CR_STATUSES: CRStatus[] = ['backlog', 'up_next', 'in_progress', 'in_review', 'blocked', 'done']

export const STATUS_LABELS: Record<CRStatus, string> = {
  backlog: 'Backlog',
  up_next: 'Up Next',
  in_progress: 'In Progress',
  in_review: 'In Review',
  blocked: 'Blocked',
  done: 'Done',
}

export const PRIORITY_LABELS: Record<CRPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export async function listCRs(): Promise<CR[]> {
  return sql<CR[]>`
    SELECT id, title, description, status, priority, assigned_to, submitted_by, labels, created_at, updated_at
    FROM change_requests
    WHERE archived_at IS NULL
    ORDER BY
      CASE status
        WHEN 'up_next'     THEN 0
        WHEN 'in_progress' THEN 1
        WHEN 'in_review'   THEN 2
        WHEN 'blocked'     THEN 3
        WHEN 'backlog'     THEN 4
        WHEN 'done'        THEN 5
      END,
      updated_at DESC
  `
}

export async function getCR(id: string): Promise<CR | null> {
  const rows = await sql<CR[]>`
    SELECT id, title, description, status, priority, assigned_to, submitted_by, labels, created_at, updated_at
    FROM change_requests WHERE id = ${id} AND archived_at IS NULL
  `
  return rows[0] ?? null
}

export async function getCRNotes(crId: string): Promise<CRNote[]> {
  return sql<CRNote[]>`
    SELECT id, cr_id, author, body, created_at FROM cr_notes
    WHERE cr_id = ${crId} ORDER BY created_at ASC
  `
}

export async function getCRAttachments(crId: string): Promise<CRAttachmentMeta[]> {
  return sql<CRAttachmentMeta[]>`
    SELECT id, cr_id, filename, mime_type, byte_size, submitted_by, created_at
    FROM cr_attachments WHERE cr_id = ${crId} ORDER BY created_at ASC
  `
}

export async function submitCR(formData: FormData): Promise<void> {
  const title = (formData.get('title') as string | null)?.trim()
  if (!title) throw new Error('Title is required')
  const description = (formData.get('description') as string | null)?.trim() || null
  const submitted_by = (formData.get('submitted_by') as string | null)?.trim() || null
  const file = formData.get('attachment') as File | null

  const [row] = await sql<{ id: string }[]>`
    INSERT INTO change_requests (title, description, submitted_by)
    VALUES (${title}, ${description}, ${submitted_by})
    RETURNING id
  `

  if (file && file.size > 0) {
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) throw new Error('Unsupported file type')
    if (file.size > 11 * 1024 * 1024) throw new Error('File too large (max 11 MB)')
    const buf = Buffer.from(await file.arrayBuffer())
    await sql`
      INSERT INTO cr_attachments (cr_id, filename, mime_type, byte_size, content, submitted_by)
      VALUES (${row.id}, ${file.name}, ${file.type}, ${file.size}, ${buf}, ${submitted_by})
    `
  }

  revalidatePath('/change-requests')
}

export async function updateCRStatus(id: string, status: CRStatus): Promise<void> {
  await sql`UPDATE change_requests SET status = ${status} WHERE id = ${id}`
  revalidatePath('/change-requests')
  revalidatePath(`/change-requests/${id}`)
}

export async function updateCRPriority(id: string, priority: CRPriority): Promise<void> {
  await sql`UPDATE change_requests SET priority = ${priority} WHERE id = ${id}`
  revalidatePath(`/change-requests/${id}`)
}

export async function updateCRAssignee(id: string, assigned_to: string): Promise<void> {
  await sql`UPDATE change_requests SET assigned_to = ${assigned_to || null} WHERE id = ${id}`
  revalidatePath(`/change-requests/${id}`)
}

export async function addCRNote(crId: string, formData: FormData): Promise<void> {
  const body = (formData.get('body') as string | null)?.trim()
  const author = (formData.get('author') as string | null)?.trim() || null
  if (!body) return
  await sql`INSERT INTO cr_notes (cr_id, author, body) VALUES (${crId}, ${author}, ${body})`
  revalidatePath(`/change-requests/${crId}`)
}

export async function archiveCR(id: string): Promise<void> {
  await sql`UPDATE change_requests SET archived_at = now() WHERE id = ${id}`
  revalidatePath('/change-requests')
}
