import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSite, getFolderTree, listPagesInFolder, createFolder, createPage } from '@/lib/actions'

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

export default async function SiteRoot({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const site = await getSite(slug)
  if (!site) notFound()

  const tree = await getFolderTree(site.id)
  if (tree.length > 0) {
    redirect(`/${slug}/folder/${tree[0].id}`)
  }

  async function handleNewFolder(formData: FormData) {
    'use server'
    await createFolder(site!.id, null, slug)
  }

  async function handleNewPage(formData: FormData) {
    'use server'
    await createPage(site!.id, null, slug)
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-bg-surface border border-border
                       flex items-center justify-center mx-auto mb-5">
          <FolderIcon className="w-6 h-6 text-accent/40" />
        </div>
        <h2 className="text-lg font-semibold text-fg-primary mb-2">{site.name}</h2>
        <p className="text-sm text-fg-tertiary mb-6">
          This site is empty. Create a folder to organize your content, or add a page directly.
        </p>
        <div className="flex items-center justify-center gap-3">
          <form action={handleNewFolder}>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-fg text-sm
                         rounded-lg hover:bg-accent-hover transition-colors font-medium"
            >
              <FolderIcon className="w-4 h-4" />
              New folder
            </button>
          </form>
          <form action={handleNewPage}>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border text-sm
                         rounded-lg hover:bg-bg-hover transition-colors font-medium text-fg-secondary"
            >
              <PageIcon className="w-4 h-4" />
              New page
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
