'use client'

import { useEffect, useState, useCallback } from 'react'
import { listContacts, type Contact } from '../lib/api'

function initials(name: string | null, email: string): string {
  if (name) {
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  }
  return email.slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-600', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500',
]

function avatarColor(email: string): string {
  let h = 0
  for (const c of email) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export function ContactsView() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const rows = await listContacts(q || undefined)
      setContacts(rows)
    } catch {
      setContacts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSearch = (q: string) => {
    setQuery(q)
    load(q || undefined)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <h2 className="text-base font-semibold">Contacts</h2>
        <span className="text-xs text-gray-400">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
        <input
          type="search"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search contacts…"
          className="w-full max-w-sm text-sm bg-gray-100 rounded px-3 py-1.5 outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading…</div>
        )}

        {!loading && contacts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-2">
            <div className="text-3xl">👤</div>
            <div>{query ? 'No results' : 'No contacts yet'}</div>
            {!query && <div className="text-xs text-gray-300">Contacts are added automatically from sent and received mail.</div>}
          </div>
        )}

        {!loading && contacts.length > 0 && (
          <div className="divide-y divide-gray-100">
            {contacts.map((contact) => (
              <div key={contact.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors">
                <div className={`w-9 h-9 rounded-full ${avatarColor(contact.email)} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
                  {initials(contact.name, contact.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {contact.name ?? contact.email}
                  </div>
                  {contact.name && (
                    <div className="text-xs text-gray-500 truncate">{contact.email}</div>
                  )}
                  {contact.org && (
                    <div className="text-xs text-gray-400 truncate">{contact.org}</div>
                  )}
                </div>
                {contact.lastContactedAt && (
                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(contact.lastContactedAt).toLocaleDateString()}
                  </div>
                )}
                <a
                  href={`mailto:${contact.email}`}
                  className="text-xs text-blue-500 hover:underline flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  Mail
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
