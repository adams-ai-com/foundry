import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import { updateGroup, deleteGroup, removeGroupMember, updateGroupAppAccess } from '@/lib/admin-actions'
import ConfirmForm from '@/components/ConfirmForm'
import GroupMemberPicker from '@/components/GroupMemberPicker'
import { addGroupMember } from '@/lib/admin-actions'

export const dynamic = 'force-dynamic'

type GroupDetail = {
  id: string
  name: string
  description: string | null
  created_at: string
}

type MemberRow = {
  user_id: string
  email: string
  name: string | null
  role: string | null
  added_at: string
}

type OrgUser = {
  id: string
  email: string
  name: string | null
}

const ALL_APPS = ['docs', 'sheets', 'mail', 'wiki'] as const

async function getGroup(orgId: string, groupId: string): Promise<GroupDetail | null> {
  const rows = await db`
    SELECT id, name, description, created_at
    FROM org_groups WHERE id = ${groupId} AND org_id = ${orgId}
  `
  return rows.length ? rows[0] as unknown as GroupDetail : null
}

async function getMembers(groupId: string, orgId: string): Promise<MemberRow[]> {
  const rows = await db`
    SELECT
      u.id AS user_id, u.email, u.name,
      m.role, gm.added_at
    FROM org_group_members gm
    JOIN users u ON u.id = gm.user_id
    LEFT JOIN org_members m ON m.user_id = gm.user_id AND m.org_id = ${orgId}
    WHERE gm.group_id = ${groupId}
    ORDER BY u.email ASC
  `
  return rows as unknown as MemberRow[]
}

async function getNonMembers(orgId: string, groupId: string): Promise<OrgUser[]> {
  const rows = await db`
    SELECT u.id, u.email, u.name
    FROM org_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.org_id = ${orgId}
      AND u.id NOT IN (
        SELECT user_id FROM org_group_members WHERE group_id = ${groupId}
      )
    ORDER BY u.email ASC
  `
  return rows as unknown as OrgUser[]
}

async function getGroupAppAccess(groupId: string): Promise<Record<string, boolean>> {
  const rows = await db`
    SELECT app, enabled FROM group_app_access WHERE group_id = ${groupId}
  ` as unknown as Array<{ app: string; enabled: boolean }>
  const map: Record<string, boolean> = {}
  for (const app of ALL_APPS) {
    const row = rows.find(r => r.app === app)
    map[app] = row ? row.enabled : true
  }
  return map
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function initials(email: string, name: string | null) {
  if (name) return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

const roleColors: Record<string, string> = {
  owner:  'bg-indigo-500/10 text-indigo-500',
  admin:  'bg-blue-500/10 text-blue-500',
  member: 'bg-fg-tertiary/10 text-fg-tertiary',
}

export default async function GroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string>>
}) {
  const session = await requireAdmin()
  if (!session.orgId) return <div className="p-8 text-fg-secondary">No active organization.</div>

  const { id: groupId } = await params
  const sp = await searchParams
  const msg = sp.msg ? decodeURIComponent(sp.msg) : null
  const err = sp.err ? decodeURIComponent(sp.err) : null

  const group = await getGroup(session.orgId, groupId)
  if (!group) notFound()

  const [members, nonMembers, appAccess] = await Promise.all([
    getMembers(groupId, session.orgId),
    getNonMembers(session.orgId, groupId),
    getGroupAppAccess(groupId),
  ])

  const updateGroupWithId     = updateGroup.bind(null, groupId)
  const deleteGroupWithId     = deleteGroup.bind(null, groupId)
  const addMemberWithId       = addGroupMember.bind(null, groupId)
  const updateAppAccessWithId = updateGroupAppAccess.bind(null, groupId)

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <a href="/admin/groups" className="text-xs text-fg-tertiary hover:text-fg-primary transition-colors">
          ← Back to groups
        </a>
      </div>

      {msg && (
        <div className="mb-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-600">
          {msg}
        </div>
      )}
      {err && (
        <div className="mb-4 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-600">
          {err}
        </div>
      )}

      {/* Group info */}
      <div className="bg-bg-raised border border-border rounded-xl p-6 mb-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-accent">
              <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0z"/>
            </svg>
          </div>
          <div>
            <div className="font-semibold text-fg-primary">{group.name}</div>
            <div className="text-xs text-fg-tertiary mt-0.5">Created {fmtDate(group.created_at)} · {members.length} {members.length === 1 ? 'member' : 'members'}</div>
          </div>
        </div>

        <form action={updateGroupWithId} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-fg-secondary mb-1.5">Name</label>
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={group.name}
              className="w-full px-3 py-2 bg-bg-base border border-border rounded-lg text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-secondary mb-1.5">Description</label>
            <input
              name="description"
              maxLength={200}
              defaultValue={group.description ?? ''}
              placeholder="Optional description"
              className="w-full px-3 py-2 bg-bg-base border border-border rounded-lg text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-accent-fg rounded-lg transition-colors"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>

      {/* App access */}
      <div className="bg-bg-raised border border-border rounded-xl p-5 mb-4">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-fg-primary">App access</h2>
          <p className="text-xs text-fg-secondary mt-0.5">
            Controls which apps members of this group can access.
            Per-user overrides on the user profile take precedence.
          </p>
        </div>
        <form action={updateAppAccessWithId} className="space-y-2">
          {ALL_APPS.map(app => (
            <label key={app} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-bg-hover transition-colors">
              <input
                type="checkbox"
                name={`app_${app}`}
                defaultChecked={appAccess[app]}
                className="h-4 w-4 rounded border-border accent-accent cursor-pointer"
              />
              <span className="text-sm text-fg-primary capitalize">{app.charAt(0).toUpperCase() + app.slice(1)}</span>
            </label>
          ))}
          <div className="pt-2">
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-accent-fg rounded-lg transition-colors"
            >
              Save app access
            </button>
          </div>
        </form>
      </div>

      {/* Members */}
      <div className="bg-bg-raised border border-border rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-fg-primary">Members</h2>
          <span className="text-xs text-fg-tertiary">{members.length}</span>
        </div>

        {nonMembers.length > 0 && (
          <GroupMemberPicker nonMembers={nonMembers} action={addMemberWithId} />
        )}

        {members.length === 0 ? (
          <p className="text-sm text-fg-tertiary text-center py-6">No members yet</p>
        ) : (
          <div className="space-y-1">
            {members.map(member => {
              const removeMember = removeGroupMember.bind(null, groupId, member.user_id)
              return (
                <div key={member.user_id} className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-bg-hover transition-colors">
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-accent text-[10px] font-semibold">
                      {initials(member.email, member.name)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {member.name && <div className="text-sm font-medium text-fg-primary leading-none">{member.name}</div>}
                    <div className={`text-xs ${member.name ? 'text-fg-tertiary mt-0.5' : 'text-fg-primary text-sm'}`}>
                      {member.email}
                    </div>
                  </div>
                  {member.role && (
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${roleColors[member.role] ?? roleColors.member}`}>
                      {member.role}
                    </span>
                  )}
                  <span className="text-xs text-fg-tertiary hidden sm:block">{fmtDate(member.added_at)}</span>
                  <ConfirmForm
                    action={removeMember}
                    message={`Remove ${member.email} from "${group.name}"?`}
                  >
                    <button
                      type="submit"
                      className="text-xs text-fg-tertiary hover:text-red-500 transition-colors px-2 py-1 rounded"
                    >
                      Remove
                    </button>
                  </ConfirmForm>
                </div>
              )
            })}
          </div>
        )}

        {nonMembers.length === 0 && members.length >= 1 && (
          <p className="text-xs text-fg-tertiary mt-3">All org members are in this group.</p>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-bg-raised border border-red-500/20 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-red-500 mb-3">Danger zone</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-fg-primary">Delete group</div>
            <div className="text-xs text-fg-tertiary mt-0.5">
              Permanently removes the group and all its memberships. Cannot be undone.
            </div>
          </div>
          <ConfirmForm
            action={deleteGroupWithId}
            message={`Delete "${group.name}"? This removes the group and all its memberships permanently.`}
          >
            <button
              type="submit"
              className="text-xs font-medium text-red-500 border border-red-500/30 hover:bg-red-500/5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              Delete group
            </button>
          </ConfirmForm>
        </div>
      </div>
    </div>
  )
}
