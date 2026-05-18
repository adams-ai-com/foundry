'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import sql from './db'

export type WikiPage = {
  id: string
  parentId: string | null
  title: string
  content: object
  isHome: boolean
  position: number
  createdAt: string
  updatedAt: string
}

export type PageTreeNode = WikiPage & { children: PageTreeNode[] }

export async function getHomePage(): Promise<WikiPage | null> {
  const rows = await sql<WikiPage[]>`
    SELECT id, parent_id, title, content, is_home, position, created_at, updated_at
    FROM pages WHERE is_home = TRUE LIMIT 1`
  return rows[0] ?? null
}

export async function getPage(id: string): Promise<WikiPage | null> {
  const rows = await sql<WikiPage[]>`
    SELECT id, parent_id, title, content, is_home, position, created_at, updated_at
    FROM pages WHERE id = ${id}`
  return rows[0] ?? null
}

export async function getPageTree(): Promise<PageTreeNode[]> {
  const rows = await sql<WikiPage[]>`
    SELECT id, parent_id, title, is_home, position, created_at, updated_at
    FROM pages ORDER BY position ASC, title ASC`

  const map = new Map<string | null, PageTreeNode[]>()
  for (const row of rows) {
    const node: PageTreeNode = { ...row, content: {}, children: [] }
    const key = row.parentId
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(node)
  }

  function attach(parentId: string | null): PageTreeNode[] {
    return (map.get(parentId) ?? []).map((node) => ({
      ...node,
      children: attach(node.id),
    }))
  }

  return attach(null)
}

export async function getBreadcrumbs(id: string): Promise<WikiPage[]> {
  const crumbs: WikiPage[] = []
  let current = await getPage(id)
  while (current) {
    crumbs.unshift(current)
    if (!current.parentId) break
    current = await getPage(current.parentId)
  }
  return crumbs
}

export async function createPage(parentId?: string | null): Promise<void> {
  const maxPos = await sql<{ max: number | null }[]>`
    SELECT MAX(position) as max FROM pages WHERE parent_id ${parentId ? sql`= ${parentId}` : sql`IS NULL`}`
  const position = (maxPos[0].max ?? -1) + 1

  const rows = await sql<{ id: string }[]>`
    INSERT INTO pages (title, content, parent_id, position)
    VALUES ('Untitled', '{}', ${parentId ?? null}, ${position})
    RETURNING id`

  redirect(`/page/${rows[0].id}`)
}

export async function updatePage(id: string, title: string, content: Record<string, unknown>): Promise<void> {
  await sql`
    UPDATE pages SET title = ${title}, content = ${sql.json(content as Parameters<typeof sql.json>[0])}, updated_at = NOW()
    WHERE id = ${id}`
  revalidatePath(`/page/${id}`)
}

export async function deletePage(id: string): Promise<void> {
  const page = await getPage(id)
  if (!page || page.isHome) return
  await sql`DELETE FROM pages WHERE id = ${id}`
  redirect(page.parentId ? `/page/${page.parentId}` : '/')
}
