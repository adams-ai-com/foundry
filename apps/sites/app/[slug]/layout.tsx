import { notFound } from 'next/navigation'
import { getSite, getFolderTree } from '@/lib/actions'
import { SiteShell } from '@/components/SiteShell'

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const site = await getSite(slug)
  if (!site) notFound()

  const tree = await getFolderTree(site.id)

  return (
    <SiteShell site={site} tree={tree}>
      {children}
    </SiteShell>
  )
}
