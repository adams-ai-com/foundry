import { notFound } from 'next/navigation'
import { getPage, getPageTree, getBreadcrumbs } from '@/lib/actions'
import { WikiShell } from '@/components/WikiShell'

export const dynamic = 'force-dynamic'

export default async function WikiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [page, tree, breadcrumbs] = await Promise.all([
    getPage(id),
    getPageTree(),
    getBreadcrumbs(id),
  ])
  if (!page) notFound()

  return <WikiShell page={page} tree={tree} breadcrumbs={breadcrumbs} />
}
