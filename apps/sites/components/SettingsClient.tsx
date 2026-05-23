'use client'

import { useState, useTransition } from 'react'
import { addMember, removeMember, updateMemberRole, deleteSite,
         setFolderPermissionMode, setFolderMemberPermission, removeFolderPermission,
         updateSiteName } from '@/lib/actions'
import type { Site, SiteMember, FolderNode, FolderPermission } from '@/lib/actions'

function ChevronDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 9l-7 7-7-7"/>
    </svg>
  )
}
function ChevronRightIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 18l6-6-6-6"/>
    </svg>
  )
}

// ── Name editor ────────────────────────────────────────────────────────────────

export function SiteNameEditor({ site }: { site: Site }) {
  const [name, setName] = useState(site.name)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!name.trim() || name === site.name) return
    startTransition(async () => { await updateSiteName(site.id, name.trim()) })
  }

  return (
    <div className="flex items-center gap-3">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
        className="flex-1 text-sm px-3 py-2 bg-bg-surface border border-border rounded-lg
                   text-fg-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 transition-all"
      />
      <button
        onClick={handleSave}
        disabled={isPending || !name.trim() || name === site.name}
        className="px-3 py-2 text-sm bg-accent text-accent-fg rounded-lg hover:bg-accent-hover
                   transition-colors font-medium disabled:opacity-40"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

// ── Members panel ──────────────────────────────────────────────────────────────

export function MembersPanel({ site, members }: { site: Site; members: SiteMember[] }) {
  return (
    <div className="space-y-4">
      {members.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-surface border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-fg-tertiary uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-fg-tertiary uppercase tracking-wide w-32">Role</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map(m => (
                <MemberRow key={m.email} member={m} site={site} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {members.length === 0 && (
        <p className="text-sm text-fg-tertiary">No members yet. Add someone below.</p>
      )}

      <form action={addMember} className="flex items-center gap-2">
        <input type="hidden" name="siteId" value={site.id} />
        <input type="hidden" name="slug" value={site.slug} />
        <input
          type="email"
          name="email"
          required
          placeholder="email@example.com"
          className="flex-1 text-sm px-3 py-2 bg-bg-surface border border-border rounded-lg
                     text-fg-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 transition-all"
        />
        <select
          name="role"
          defaultValue="viewer"
          className="text-sm px-3 py-2 bg-bg-surface border border-border rounded-lg
                     text-fg-primary outline-none focus:border-accent/50 transition-all"
        >
          <option value="owner">Owner</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 text-sm bg-accent text-accent-fg rounded-lg hover:bg-accent-hover
                     transition-colors font-medium"
        >
          Add
        </button>
      </form>
    </div>
  )
}

function MemberRow({ member, site }: { member: SiteMember; site: Site }) {
  const [isPending, startTransition] = useTransition()

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value
    startTransition(async () => { await updateMemberRole(site.id, member.email, role, site.slug) })
  }

  function handleRemove() {
    if (!confirm(`Remove ${member.email} from this site?`)) return
    startTransition(async () => { await removeMember(site.id, member.email, site.slug) })
  }

  return (
    <tr className="group hover:bg-bg-hover transition-colors">
      <td className="px-4 py-2.5 text-fg-primary">{member.email}</td>
      <td className="px-4 py-2.5">
        <select
          value={member.role}
          onChange={handleRoleChange}
          className="text-sm px-2 py-1 bg-bg-surface border border-border rounded-md
                     text-fg-primary outline-none focus:border-accent/50 transition-all"
        >
          <option value="owner">Owner</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      </td>
      <td className="px-4 py-2.5 text-right">
        <button
          onClick={handleRemove}
          className="text-xs text-fg-tertiary hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
        >
          Remove
        </button>
      </td>
    </tr>
  )
}

// ── Folder permissions panel ───────────────────────────────────────────────────

export function FolderPermissionsPanel({
  site,
  tree,
  members,
  allPermissions,
}: {
  site: Site
  tree: FolderNode[]
  members: SiteMember[]
  allPermissions: FolderPermission[]
}) {
  const permMap = new Map<string, FolderPermission[]>()
  for (const p of allPermissions) {
    if (!permMap.has(p.folderId)) permMap.set(p.folderId, [])
    permMap.get(p.folderId)!.push(p)
  }

  return (
    <div className="space-y-2">
      <FolderPermList nodes={tree} site={site} members={members} permMap={permMap} depth={0} />
      {tree.length === 0 && (
        <p className="text-sm text-fg-tertiary">No folders in this site yet.</p>
      )}
    </div>
  )
}

function FolderPermList({
  nodes, site, members, permMap, depth,
}: {
  nodes: FolderNode[]
  site: Site
  members: SiteMember[]
  permMap: Map<string, FolderPermission[]>
  depth: number
}) {
  return (
    <>
      {nodes.map(node => (
        <FolderPermItem key={node.id} node={node} site={site} members={members}
                        perms={permMap.get(node.id) ?? []} permMap={permMap} depth={depth} />
      ))}
    </>
  )
}

function FolderPermItem({
  node, site, members, perms, permMap, depth,
}: {
  node: FolderNode
  site: Site
  members: SiteMember[]
  perms: FolderPermission[]
  permMap: Map<string, FolderPermission[]>
  depth: number
}) {
  const [open, setOpen] = useState(node.permissionMode === 'override')
  const [isPending, startTransition] = useTransition()

  function handleToggleMode() {
    const newMode = node.permissionMode === 'inherit' ? 'override' : 'inherit'
    if (newMode === 'inherit' && perms.length > 0) {
      if (!confirm('Switch to inherit? This will remove all permission overrides for this folder.')) return
    }
    startTransition(async () => { await setFolderPermissionMode(node.id, newMode, site.slug) })
  }

  function handleRoleChange(email: string, role: string) {
    startTransition(async () => { await setFolderMemberPermission(node.id, email, role, site.slug) })
  }

  function handleRemovePerm(email: string) {
    startTransition(async () => { await removeFolderPermission(node.id, email, site.slug) })
  }

  const isOverride = node.permissionMode === 'override'
  const membersNotOverridden = members.filter(m => !perms.some(p => p.email === m.email))

  return (
    <div className="rounded-xl border border-border overflow-hidden" style={{ marginLeft: `${depth * 20}px` }}>
      <div
        className="flex items-center gap-3 px-4 py-3 bg-bg-surface cursor-pointer hover:bg-bg-hover transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-fg-tertiary flex-shrink-0">
          {open
            ? <ChevronDownIcon className="w-3.5 h-3.5" />
            : <ChevronRightIcon className="w-3.5 h-3.5" />}
        </span>
        <span className="flex-1 text-sm font-medium text-fg-primary">{node.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          isOverride
            ? 'bg-amber-500/10 text-amber-600'
            : 'bg-bg-hover text-fg-tertiary'
        }`}>
          {isOverride ? 'Override' : 'Inherit'}
        </span>
      </div>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4 bg-bg-base">
          <div className="flex items-center justify-between">
            <p className="text-sm text-fg-secondary">
              {isOverride
                ? 'This folder has custom permissions. Members not listed below inherit their site role.'
                : 'This folder inherits permissions from the site. Override to set custom access per member.'}
            </p>
            <button
              onClick={handleToggleMode}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ml-4 flex-shrink-0 ${
                isOverride
                  ? 'bg-bg-hover text-fg-secondary hover:bg-bg-active'
                  : 'bg-accent/10 text-accent hover:bg-accent/20'
              }`}
            >
              {isOverride ? 'Switch to inherit' : 'Override permissions'}
            </button>
          </div>

          {isOverride && (
            <>
              {perms.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-border">
                      {perms.map(p => (
                        <tr key={p.email} className="group hover:bg-bg-hover transition-colors">
                          <td className="px-3 py-2 text-fg-primary">{p.email}</td>
                          <td className="px-3 py-2">
                            <select
                              value={p.role}
                              onChange={e => handleRoleChange(p.email, e.target.value)}
                              className="text-xs px-2 py-1 bg-bg-surface border border-border rounded-md
                                         text-fg-primary outline-none focus:border-accent/50 transition-all"
                            >
                              <option value="owner">Owner</option>
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                              <option value="none">No access</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => handleRemovePerm(p.email)}
                              className="text-xs text-fg-tertiary hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {membersNotOverridden.length > 0 && (
                <div>
                  <p className="text-xs text-fg-tertiary mb-2">Add override for a site member:</p>
                  <div className="flex flex-wrap gap-2">
                    {membersNotOverridden.map(m => (
                      <button
                        key={m.email}
                        onClick={() => handleRoleChange(m.email, m.role)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-border bg-bg-surface
                                   hover:border-accent/30 hover:bg-bg-raised text-fg-secondary transition-all"
                      >
                        + {m.email}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {members.length === 0 && (
                <p className="text-xs text-fg-tertiary">Add site members first to set folder overrides.</p>
              )}
            </>
          )}
        </div>
      )}

      {node.children.length > 0 && (
        <div className="border-t border-border">
          <FolderPermList nodes={node.children} site={site} members={members}
                          permMap={permMap} depth={0} />
        </div>
      )}
    </div>
  )
}

// ── Danger zone ────────────────────────────────────────────────────────────────

export function DangerZone({ site }: { site: Site }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm(`Delete "${site.name}" and all its content? This cannot be undone.`)) return
    startTransition(async () => { await deleteSite(site.id) })
  }

  return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 p-5">
      <h3 className="text-sm font-semibold text-danger mb-1">Delete this site</h3>
      <p className="text-sm text-fg-secondary mb-4">
        Permanently removes the site, all folders, pages, and member settings. This cannot be undone.
      </p>
      <button
        onClick={handleDelete}
        className="text-sm px-4 py-2 bg-danger/10 text-danger hover:bg-danger/20
                   rounded-lg font-medium transition-colors border border-danger/20"
      >
        Delete site
      </button>
    </div>
  )
}
