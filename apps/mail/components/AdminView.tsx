'use client'

import { useEffect, useState } from 'react'
import { listAdminAccounts, addMailAccount, listMailAccounts, type AdminAccount, type MailAccountGroup } from '../lib/api'

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: color + '20', color }}>
      {label}
    </span>
  )
}

function DnsRecord({ type, name, value, priority, note }: { type: string; name: string; value?: string; priority?: number; note?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono space-y-0.5">
      <div><span className="text-gray-400">Type: </span><span className="text-gray-800">{type}{priority ? ` (priority ${priority})` : ''}</span></div>
      <div><span className="text-gray-400">Name: </span><span className="text-gray-800 break-all">{name}</span></div>
      {value && <div><span className="text-gray-400">Value: </span><span className="text-gray-800 break-all">{value}</span></div>}
      {note && <div className="text-gray-500 font-sans">{note}</div>}
    </div>
  )
}

export function AdminView() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [groups, setGroups] = useState<MailAccountGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [domain, setDomain] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [groupId, setGroupId] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addResult, setAddResult] = useState<Awaited<ReturnType<typeof addMailAccount>> | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [accts, userAccts] = await Promise.all([listAdminAccounts(), listMailAccounts()])
      setAccounts(accts)
      setGroups(userAccts.groups)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!domain.trim()) { setAddError('Domain is required'); return }
    setAdding(true)
    setAddError(null)
    try {
      const result = await addMailAccount({
        domain: domain.trim(),
        displayName: displayName.trim() || undefined,
        groupId: groupId || undefined,
      })
      setAddResult(result)
      setDomain('')
      setDisplayName('')
      setGroupId('')
      setShowAddForm(false)
      await load()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add domain')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Mail Accounts</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage hosted domains and view account status</p>
          </div>
          <button
            onClick={() => { setShowAddForm(true); setAddResult(null) }}
            className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Add domain
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm">Add hosted domain</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Domain *</label>
                <input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g. supportingpeers.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Display name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Supporting Peers"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Group</label>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Ungrouped</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {addError && <p className="text-xs text-red-600">{addError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={adding}
                className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
              >
                {adding ? 'Adding…' : 'Add domain'}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* DNS records from last add */}
        {addResult && (
          <div className="bg-white border border-green-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-semibold text-sm">✓ Domain added: {addResult.account.domain}</span>
            </div>
            <p className="text-xs text-gray-600">Set these DNS records at your domain registrar. Mail won't route until MX is live.</p>
            <div className="space-y-2">
              <DnsRecord {...addResult.dnsRecords.mx} />
              <DnsRecord {...addResult.dnsRecords.spf} />
              <DnsRecord {...addResult.dnsRecords.dmarc} />
              <DnsRecord {...addResult.dnsRecords.dkim} note={addResult.dnsRecords.dkim.note} />
            </div>
            <button onClick={() => setAddResult(null)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
          </div>
        )}

        {/* Account list */}
        {loading ? (
          <div className="text-sm text-gray-400">Loading…</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 shadow-sm overflow-hidden">
            {accounts.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-gray-400">No accounts yet</div>
            )}
            {accounts.map((acct) => (
              <div key={acct.id} className="px-6 py-4 flex items-center gap-4">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: acct.avatarColor ?? '#6366f1' }}
                >
                  {acct.domain.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 truncate">{acct.displayName}</span>
                    <Badge
                      label={acct.accountType}
                      color={acct.accountType === 'hosted' ? '#6366f1' : '#6b7280'}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{acct.domain}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-medium text-gray-700">{acct.messageCount.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">messages</div>
                </div>
                {acct.inboxUnread > 0 && (
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                    {acct.inboxUnread} unread
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
