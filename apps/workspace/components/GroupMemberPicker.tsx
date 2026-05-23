'use client'

import { useState } from 'react'

type OrgUser = { id: string; email: string; name: string | null }

export default function GroupMemberPicker({
  nonMembers,
  action,
}: {
  nonMembers: OrgUser[]
  action: (fd: FormData) => Promise<void>
}) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState('')

  const filtered = q
    ? nonMembers.filter(u =>
        u.email.toLowerCase().includes(q.toLowerCase()) ||
        (u.name ?? '').toLowerCase().includes(q.toLowerCase())
      )
    : nonMembers

  return (
    <form action={action} className="mb-4 space-y-2">
      <input
        type="text"
        value={q}
        onChange={e => { setQ(e.target.value); setSelected('') }}
        placeholder="Search members to add…"
        className="w-full px-3 py-2 bg-bg-base border border-border rounded-lg text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      <div className="flex gap-2">
        <select
          name="user_id"
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="flex-1 px-3 py-2 bg-bg-base border border-border rounded-lg text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          <option value="">Select…</option>
          {filtered.map(u => (
            <option key={u.id} value={u.id}>
              {u.name ? `${u.name} (${u.email})` : u.email}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!selected}
          className="px-3 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-accent-fg rounded-lg transition-colors flex-shrink-0 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </form>
  )
}
