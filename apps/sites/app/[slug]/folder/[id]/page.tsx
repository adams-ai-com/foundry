import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  getSite, getFolder, getFolderBreadcrumbs, listSubFolders, listPagesInFolder,
  createFolder, createPage, deleteFolder, renameFolder, listFilesInFolder
} from '@/lib/actions'
import { FileUpload } from '@/components/FileUpload'
import { FileList } from '@/components/FileList'
import { FolderRenameForm } from '@/components/FolderRenameForm'

export const dynamic = 'force-dynamic'

function FolderIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
    </svg>
  )
}
function PageIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
  )
}
function PlusIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}
function LockIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5" y="11" width="14" height="10" rx="2" ry="2"/>
      <path d="M8 11V7a4 4 0 018 0v4"/>
    </svg>
  )
}

function formatDate(ts: string): string {
  const date = new Date(ts)
  const now   = new Date()
  const diffMs   = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffDays < 1)   return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)   return date.toLocaleDateString('en-US', { weekday: 'long' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function FolderPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const [site, folder] = await Promise.all([getSite(slug), getFolder(id)])
  if (!site || !folder) notFound()

  const [breadcrumbs, subFolders, pages, siteFiles] = await Promise.all([
    getFolderBreadcrumbs(id),
    listSubFolders(id),
    listPagesInFolder(id),
    listFilesInFolder(id),
  ])

  async function handleNewSubFolder() {
    'use server'
    await createFolder(site!.id, id, slug)
  }

  async function handleNewPage() {
    'use server'
    await createPage(site!.id, id, slug)
  }

  async function handleDelete() {
    'use server'
    await deleteFolder(id, slug, folder!.parentId)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm mb-6 flex-wrap">
          <Link href={`/${slug}`} className="text-fg-tertiary hover:text-accent transition-colors">
            {site.name}
          </Link>
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <span className="text-fg-tertiary/50">/</span>
              {i === breadcrumbs.length - 1 ? (
                <span className="text-fg-primary font-medium">{crumb.name}</span>
              ) : (
                <Link href={`/${slug}/folder/${crumb.id}`}
                      className="text-fg-tertiary hover:text-accent transition-colors">
                  {crumb.name}
                </Link>
              )}
            </span>
          ))}
        </nav>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <FolderRenameForm folderId={id} currentName={folder.name} siteSlug={slug} />
          {folder.permissionMode === 'override' && (
            <span className="flex items-center gap-1 text-xs text-fg-tertiary px-2 py-1 rounded-full bg-bg-surface border border-border">
              <LockIcon className="w-3 h-3" />
              Custom permissions
            </span>
          )}
          <div className="flex-1" />
          <form action={handleDelete}>
            <button
              type="submit"
              className="text-xs text-fg-tertiary hover:text-danger transition-colors px-2 py-1 rounded hover:bg-bg-hover"
            >
              Delete folder
            </button>
          </form>
        </div>

        {/* Sub-folders */}
        {subFolders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-fg-tertiary uppercase tracking-wide mb-3">Folders</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {subFolders.map(f => (
                <Link
                  key={f.id}
                  href={`/${slug}/folder/${f.id}`}
                  className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-border
                             bg-bg-surface hover:bg-bg-raised hover:border-accent/20 transition-all duration-150"
                >
                  <FolderIcon className="w-4 h-4 text-accent/40 group-hover:text-accent transition-colors flex-shrink-0" />
                  <span className="text-sm font-medium text-fg-primary group-hover:text-accent transition-colors overflow-hidden text-ellipsis whitespace-nowrap">
                    {f.name}
                  </span>
                  {f.permissionMode === 'override' && (
                    <LockIcon className="w-3 h-3 text-fg-tertiary flex-shrink-0 ml-auto" />
                  )}
                </Link>
              ))}
              <form action={handleNewSubFolder}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border
                             hover:border-accent/40 hover:bg-bg-surface transition-all duration-150 text-fg-tertiary hover:text-accent"
                >
                  <PlusIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">New folder</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Pages */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-fg-tertiary uppercase tracking-wide">Pages</h2>
            <form action={handleNewPage}>
              <button
                type="submit"
                className="flex items-center gap-1 text-xs text-fg-tertiary hover:text-accent
                           px-2 py-1 rounded hover:bg-bg-hover transition-colors"
              >
                <PlusIcon className="w-3 h-3" />
                New page
              </button>
            </form>
          </div>

          {pages.length === 0 && subFolders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 flex flex-col items-center gap-3">
              <PageIcon className="w-8 h-8 text-fg-tertiary/40" />
              <p className="text-sm text-fg-tertiary">This folder is empty</p>
              <div className="flex gap-2">
                <form action={handleNewPage}>
                  <button
                    type="submit"
                    className="text-sm px-4 py-2 bg-accent text-accent-fg rounded-lg hover:bg-accent-hover transition-colors font-medium"
                  >
                    New page
                  </button>
                </form>
                <form action={handleNewSubFolder}>
                  <button
                    type="submit"
                    className="text-sm px-4 py-2 bg-bg-surface border border-border text-fg-secondary rounded-lg hover:bg-bg-hover transition-colors font-medium"
                  >
                    New folder
                  </button>
                </form>
              </div>
            </div>
          ) : pages.length > 0 ? (
            <div className="rounded-xl border border-border overflow-hidden">
              <ul className="divide-y divide-border">
                {pages.map(p => (
                  <li key={p.id} className="group">
                    <Link
                      href={`/${slug}/page/${p.id}`}
                      className="flex items-center gap-3.5 px-4 py-3 hover:bg-bg-hover transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg bg-bg-surface border border-border flex-shrink-0
                                     flex items-center justify-center
                                     group-hover:bg-accent/10 group-hover:border-accent/20 transition-all">
                        <PageIcon className="w-3.5 h-3.5 text-accent/40 group-hover:text-accent transition-colors" />
                      </div>
                      <span className="flex-1 text-sm font-medium text-fg-primary group-hover:text-accent transition-colors overflow-hidden text-ellipsis whitespace-nowrap">
                        {p.title || 'Untitled'}
                      </span>
                      <span className="text-xs text-fg-tertiary shrink-0 tabular-nums">
                        {formatDate(p.updatedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Files */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-fg-tertiary uppercase tracking-wide">Files</h2>
            <span className="text-xs text-fg-tertiary">{siteFiles.length > 0 ? `${siteFiles.length} file${siteFiles.length !== 1 ? 's' : ''}` : ''}</span>
          </div>
          <div className="space-y-3">
            <FileList files={siteFiles} />
            <FileUpload siteId={site.id} folderId={id} />
          </div>
        </div>


      </div>
    </div>
  )
}
