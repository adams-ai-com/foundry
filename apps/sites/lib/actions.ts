'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import sql from './db'

// ── Types ──────────────────────────────────────────────────────────────────────

export type Site = {
  id: string
  name: string
  slug: string
  description: string
  createdAt: string
  updatedAt: string
}

export type SiteMember = {
  id: string
  siteId: string
  email: string
  role: 'owner' | 'editor' | 'viewer'
  addedAt: string
}

export type Folder = {
  id: string
  siteId: string
  parentId: string | null
  name: string
  permissionMode: 'inherit' | 'override'
  position: number
  createdAt: string
  updatedAt: string
}

export type FolderNode = Folder & { children: FolderNode[] }

export type FolderPermission = {
  id: string
  folderId: string
  email: string
  role: 'owner' | 'editor' | 'viewer' | 'none'
}

export type SitePage = {
  id: string
  siteId: string
  folderId: string | null
  title: string
  content: object
  position: number
  createdAt: string
  updatedAt: string
}

export type SitePageSummary = Omit<SitePage, 'content'>
export type SiteFile = {
  id: string
  siteId: string
  folderId: string | null
  name: string
  mimeType: string
  size: number
  storagePath: string
  createdAt: string
}



// ── Sites ──────────────────────────────────────────────────────────────────────

export async function listSites(): Promise<(Site & { memberCount: number; folderCount: number; pageCount: number })[]> {
  return sql`
    SELECT s.*,
      (SELECT COUNT(*)::int FROM site_members WHERE site_id = s.id) AS member_count,
      (SELECT COUNT(*)::int FROM folders WHERE site_id = s.id) AS folder_count,
      (SELECT COUNT(*)::int FROM site_pages WHERE site_id = s.id) AS page_count
    FROM sites s ORDER BY s.updated_at DESC`
}

export async function getSite(slug: string): Promise<Site | null> {
  const rows = await sql<Site[]>`SELECT * FROM sites WHERE slug = ${slug}`
  return rows[0] ?? null
}

export async function createSite(formData: FormData): Promise<void> {
  const name = (formData.get('name') as string | null)?.trim()
  if (!name) return
  let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site'
  const existing = await sql<{ slug: string }[]>`SELECT slug FROM sites WHERE slug LIKE ${slug + '%'}`
  if (existing.length > 0) slug = `${slug}-${Date.now().toString(36)}`
  await sql`INSERT INTO sites (name, slug) VALUES (${name}, ${slug})`
  redirect(`/${slug}`)
}

export async function updateSiteName(id: string, name: string): Promise<void> {
  await sql`UPDATE sites SET name = ${name}, updated_at = NOW() WHERE id = ${id}`
  revalidatePath('/', 'layout')
}

export async function deleteSite(id: string): Promise<void> {
  await sql`DELETE FROM sites WHERE id = ${id}`
  redirect('/')
}

// ── Members ────────────────────────────────────────────────────────────────────

export async function getMembers(siteId: string): Promise<SiteMember[]> {
  return sql<SiteMember[]>`SELECT * FROM site_members WHERE site_id = ${siteId} ORDER BY added_at ASC`
}

export async function addMember(formData: FormData): Promise<void> {
  const siteId = formData.get('siteId') as string
  const slug   = formData.get('slug') as string
  const email  = (formData.get('email') as string | null)?.trim().toLowerCase()
  const role   = (formData.get('role') as string) || 'viewer'
  if (!email || !siteId) return
  await sql`
    INSERT INTO site_members (site_id, email, role)
    VALUES (${siteId}, ${email}, ${role})
    ON CONFLICT (site_id, email) DO UPDATE SET role = ${role}`
  revalidatePath(`/${slug}/settings`)
}

export async function removeMember(siteId: string, email: string, slug: string): Promise<void> {
  await sql`DELETE FROM site_members WHERE site_id = ${siteId} AND email = ${email}`
  revalidatePath(`/${slug}/settings`)
}

export async function updateMemberRole(siteId: string, email: string, role: string, slug: string): Promise<void> {
  await sql`UPDATE site_members SET role = ${role} WHERE site_id = ${siteId} AND email = ${email}`
  revalidatePath(`/${slug}/settings`)
}

// ── Folders ────────────────────────────────────────────────────────────────────

export async function getFolderTree(siteId: string): Promise<FolderNode[]> {
  const rows = await sql<Folder[]>`
    SELECT * FROM folders WHERE site_id = ${siteId} ORDER BY position ASC, name ASC`
  const map = new Map<string | null, FolderNode[]>()
  for (const row of rows) {
    const node: FolderNode = { ...row, children: [] }
    const key = row.parentId
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(node)
  }
  function attach(parentId: string | null): FolderNode[] {
    return (map.get(parentId) ?? []).map(node => ({ ...node, children: attach(node.id) }))
  }
  return attach(null)
}

export async function getFolder(id: string): Promise<Folder | null> {
  const rows = await sql<Folder[]>`SELECT * FROM folders WHERE id = ${id}`
  return rows[0] ?? null
}

export async function listSubFolders(parentId: string): Promise<Folder[]> {
  return sql<Folder[]>`SELECT * FROM folders WHERE parent_id = ${parentId} ORDER BY position ASC, name ASC`
}

export async function getFolderBreadcrumbs(folderId: string): Promise<Folder[]> {
  const crumbs: Folder[] = []
  let current = await getFolder(folderId)
  while (current) {
    crumbs.unshift(current)
    if (!current.parentId) break
    current = await getFolder(current.parentId)
  }
  return crumbs
}

export async function createFolder(siteId: string, parentId: string | null, siteSlug: string): Promise<void> {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO folders (site_id, parent_id, name)
    VALUES (${siteId}, ${parentId}, ${'New folder'})
    RETURNING id`
  await sql`UPDATE sites SET updated_at = NOW() WHERE id = ${siteId}`
  redirect(`/${siteSlug}/folder/${rows[0].id}`)
}

export async function renameFolder(id: string, name: string, siteSlug: string): Promise<void> {
  await sql`UPDATE folders SET name = ${name}, updated_at = NOW() WHERE id = ${id}`
  revalidatePath(`/${siteSlug}`, 'layout')
}

export async function deleteFolder(id: string, siteSlug: string, parentId: string | null): Promise<void> {
  await sql`DELETE FROM folders WHERE id = ${id}`
  if (parentId) {
    redirect(`/${siteSlug}/folder/${parentId}`)
  } else {
    redirect(`/${siteSlug}`)
  }
}

// ── Folder permissions ─────────────────────────────────────────────────────────

export async function getFolderPermissions(folderId: string): Promise<FolderPermission[]> {
  return sql<FolderPermission[]>`SELECT * FROM folder_permissions WHERE folder_id = ${folderId}`
}

export async function getAllFolderPermissions(siteId: string): Promise<FolderPermission[]> {
  return sql<FolderPermission[]>`
    SELECT fp.* FROM folder_permissions fp
    JOIN folders f ON f.id = fp.folder_id
    WHERE f.site_id = ${siteId}`
}

export async function setFolderPermissionMode(folderId: string, mode: 'inherit' | 'override', siteSlug: string): Promise<void> {
  await sql`UPDATE folders SET permission_mode = ${mode} WHERE id = ${folderId}`
  if (mode === 'inherit') {
    await sql`DELETE FROM folder_permissions WHERE folder_id = ${folderId}`
  }
  revalidatePath(`/${siteSlug}`, 'layout')
}

export async function setFolderMemberPermission(folderId: string, email: string, role: string, siteSlug: string): Promise<void> {
  await sql`
    INSERT INTO folder_permissions (folder_id, email, role)
    VALUES (${folderId}, ${email}, ${role})
    ON CONFLICT (folder_id, email) DO UPDATE SET role = ${role}`
  revalidatePath(`/${siteSlug}/settings`)
}

export async function removeFolderPermission(folderId: string, email: string, siteSlug: string): Promise<void> {
  await sql`DELETE FROM folder_permissions WHERE folder_id = ${folderId} AND email = ${email}`
  revalidatePath(`/${siteSlug}/settings`)
}

// ── Pages ──────────────────────────────────────────────────────────────────────

export async function listPagesInFolder(folderId: string): Promise<SitePageSummary[]> {
  return sql<SitePageSummary[]>`
    SELECT id, site_id, folder_id, title, position, created_at, updated_at
    FROM site_pages WHERE folder_id = ${folderId} ORDER BY position ASC, title ASC`
}

export async function getPage(id: string): Promise<SitePage | null> {
  const rows = await sql<SitePage[]>`SELECT * FROM site_pages WHERE id = ${id}`
  return rows[0] ?? null
}

export async function createPage(siteId: string, folderId: string | null, siteSlug: string): Promise<void> {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO site_pages (site_id, folder_id, title, content)
    VALUES (${siteId}, ${folderId}, ${'Untitled'}, '{}')
    RETURNING id`
  await sql`UPDATE sites SET updated_at = NOW() WHERE id = ${siteId}`
  redirect(`/${siteSlug}/page/${rows[0].id}`)
}

export async function updatePage(id: string, title: string, content: Record<string, unknown>): Promise<void> {
  await sql`
    UPDATE site_pages
    SET title = ${title}, content = ${sql.json(content as Parameters<typeof sql.json>[0])}, updated_at = NOW()
    WHERE id = ${id}`
}

export async function deletePage(id: string, siteSlug: string, folderId: string | null): Promise<void> {
  await sql`DELETE FROM site_pages WHERE id = ${id}`
  if (folderId) {
    redirect(`/${siteSlug}/folder/${folderId}`)
  } else {
    redirect(`/${siteSlug}`)
  }
}

// ── Files ──────────────────────────────────────────────────────────────────────

export async function listFilesInFolder(folderId: string): Promise<SiteFile[]> {
  return sql<SiteFile[]>`
    SELECT * FROM site_files WHERE folder_id = ${folderId} ORDER BY created_at DESC`
}

export async function deleteFileRecord(id: string, siteSlug: string, folderId: string | null): Promise<void> {
  const { unlink } = await import('fs/promises')
  const rows = await sql<{ storagePath: string }[]>`
    DELETE FROM site_files WHERE id = ${id} RETURNING storage_path`
  if (rows[0]) {
    try { await unlink(rows[0].storagePath) } catch { /* already gone */ }
  }
  if (folderId) revalidatePath(`/${siteSlug}/folder/${folderId}`)
  else          revalidatePath(`/${siteSlug}`)
}
