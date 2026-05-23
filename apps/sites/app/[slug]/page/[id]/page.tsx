import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSite, getPage, getFolder } from '@/lib/actions'
import { PageEditor } from '@/components/PageEditor'

export const dynamic = 'force-dynamic'

export default async function SitePageView({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const [site, page] = await Promise.all([getSite(slug), getPage(id)])
  if (!site || !page) notFound()

  const folder = page.folderId ? await getFolder(page.folderId) : null

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Breadcrumb bar */}
      <div className="border-b border-border px-4 py-2 flex items-center gap-1 text-xs text-fg-tertiary bg-bg-raised flex-shrink-0">
        <Link href={`/${slug}`} className="hover:text-accent transition-colors">{site.name}</Link>
        {folder && (
          <>
            <span className="text-fg-tertiary/40">/</span>
            <Link href={`/${slug}/folder/${folder.id}`} className="hover:text-accent transition-colors">
              {folder.name}
            </Link>
          </>
        )}
        <span className="text-fg-tertiary/40">/</span>
        <span className="text-fg-primary">{page.title || 'Untitled'}</span>
      </div>

      <PageEditor page={page} siteSlug={slug} />
    </div>
  )
}
