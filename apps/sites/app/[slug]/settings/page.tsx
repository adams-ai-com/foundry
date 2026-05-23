import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSite, getMembers, getFolderTree, getAllFolderPermissions } from '@/lib/actions'
import { SiteNameEditor, MembersPanel, FolderPermissionsPanel, DangerZone } from '@/components/SettingsClient'

export const dynamic = 'force-dynamic'

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 mb-5">
      <h2 className="text-sm font-semibold text-fg-primary whitespace-nowrap">{label}</h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const site = await getSite(slug)
  if (!site) notFound()

  const [members, tree, allPermissions] = await Promise.all([
    getMembers(site.id),
    getFolderTree(site.id),
    getAllFolderPermissions(site.id),
  ])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-12">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href={`/${slug}`}
            className="text-sm text-fg-tertiary hover:text-accent transition-colors"
          >
            ← {site.name}
          </Link>
          <span className="text-fg-tertiary/40">/</span>
          <h1 className="text-lg font-semibold text-fg-primary">Settings</h1>
        </div>

        {/* Site name */}
        <section>
          <SectionHeader label="Site name" />
          <SiteNameEditor site={site} />
        </section>

        {/* Members */}
        <section>
          <SectionHeader label="Members" />
          <p className="text-sm text-fg-secondary mb-4">
            Members have access to this site. Set a role to define what they can do:
            <span className="text-fg-tertiary"> Owner</span> = full control,
            <span className="text-fg-tertiary"> Editor</span> = create and edit content,
            <span className="text-fg-tertiary"> Viewer</span> = read only.
          </p>
          <MembersPanel site={site} members={members} />
        </section>

        {/* Folder permissions */}
        <section>
          <SectionHeader label="Folder permissions" />
          <p className="text-sm text-fg-secondary mb-4">
            Each folder inherits the site&apos;s member roles by default. Override a folder to set
            custom permissions — useful for restricting sensitive content or granting access to
            external collaborators.
          </p>
          <FolderPermissionsPanel
            site={site}
            tree={tree}
            members={members}
            allPermissions={allPermissions}
          />
        </section>

        {/* Danger zone */}
        <section>
          <SectionHeader label="Danger zone" />
          <DangerZone site={site} />
        </section>

      </div>
    </div>
  )
}
