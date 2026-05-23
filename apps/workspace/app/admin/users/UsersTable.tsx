'use client'

import { useState, useTransition } from 'react'

type UserRow = {
  id: string
  email: string
  name: string | null
  role: string | null
  joined_at: string | null
  last_sign_in: string | null
  active_sessions: number
}

function roleBadge(role: string | null) {
  const styles: Record<string, string> = {
    owner: 'bg-indigo-500/10 text-indigo-500',
    admin: 'bg-blue-500/10 text-blue-500',
    member: 'bg-fg-tertiary/10 text-fg-tertiary',
  }
  const label = role ?? 'no org'
  const cls = (role && styles[role]) ?? 'bg-fg-tertiary/10 text-fg-tertiary'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  )
}

function statusBadge(activeSessions: number) {
  return activeSessions > 0
    ? <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Active</span>
    : <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-fg-tertiary"><span className="w-1.5 h-1.5 rounded-full bg-fg-tertiary/40 inline-block" />Inactive</span>
}

function fmtDate(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function initials(email: string, name: string | null) {
  if (name) return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

type Props = {
  users: UserRow[]
  bulkDeactivate: (fd: FormData) => Promise<void>
  bulkRemove: (fd: FormData) => Promise<void>
}

export default function UsersTable({ users, bulkDeactivate, bulkRemove }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  const toggleAll = () => {
    if (selected.size === users.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(users.map(u => u.id)))
    }
  }

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function buildFormData(ids: Set<string>): FormData {
    const fd = new FormData()
    ids.forEach(id => fd.append('user_id', id))
    return fd
  }

  const count = selected.size

  return (
    <div className="relative">
      {/* Bulk action bar */}
      {count > 0 && (
        <div className="sticky top-14 z-10 mb-3 flex items-center gap-3 bg-bg-raised border border-border rounded-xl px-4 py-3 shadow-md">
          <span className="text-sm font-medium text-fg-primary">{count} selected</span>
          <div className="flex-1" />
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Deactivate ${count} selected user${count === 1 ? '' : 's'}? They will be signed out immediately.`)) return
              startTransition(() => bulkDeactivate(buildFormData(selected)))
            }}
            className="px-3 py-1.5 text-xs font-medium text-amber-600 border border-amber-500/30 hover:bg-amber-500/5 rounded-lg transition-colors disabled:opacity-50"
          >
            Deactivate selected
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Remove ${count} selected user${count === 1 ? '' : 's'} from the organization? Their access will be revoked immediately.`)) return
              startTransition(() => bulkRemove(buildFormData(selected)))
            }}
            className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-500/30 hover:bg-red-500/5 rounded-lg transition-colors disabled:opacity-50"
          >
            Remove from org
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="px-3 py-1.5 text-xs font-medium text-fg-tertiary hover:text-fg-primary border border-border rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      <div className="bg-bg-raised border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={users.length > 0 && selected.size === users.length}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-border accent-accent cursor-pointer"
                />
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">User</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Last sign-in</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Member since</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-fg-tertiary text-sm">
                  No users found
                </td>
              </tr>
            )}
            {users.map(user => (
              <tr
                key={user.id}
                className={`hover:bg-bg-hover transition-colors ${selected.has(user.id) ? 'bg-accent/5' : ''}`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(user.id)}
                    onChange={() => toggle(user.id)}
                    className="h-4 w-4 rounded border-border accent-accent cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-accent text-xs font-semibold">{initials(user.email, user.name)}</span>
                    </div>
                    <div>
                      {user.name && <div className="font-medium text-fg-primary">{user.name}</div>}
                      <div className={user.name ? 'text-xs text-fg-tertiary' : 'text-fg-primary'}>{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{roleBadge(user.role)}</td>
                <td className="px-4 py-3">{statusBadge(user.active_sessions)}</td>
                <td className="px-4 py-3 text-fg-secondary">{fmtDate(user.last_sign_in)}</td>
                <td className="px-4 py-3 text-fg-secondary">{fmtDate(user.joined_at)}</td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={`/admin/users/${user.id}`}
                    className="text-xs text-fg-tertiary hover:text-fg-primary transition-colors"
                  >
                    View →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
