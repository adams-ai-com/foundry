'use client'

import { useState, useEffect } from 'react'
import { listDecisions, createDecision, updateDecision, deleteDecision, type Decision } from '../lib/api'

export function DecisionsView() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDecision, setEditingDecision] = useState<Decision | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const { decisions: rows } = await listDecisions()
      setDecisions(rows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    await deleteDecision(id)
    load()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Decisions</h2>
          <p className="text-xs text-gray-500 mt-0.5">Explicit outcomes, searchable forever</p>
        </div>
        <button
          data-testid="log-decision-button"
          onClick={() => { setEditingDecision(null); setShowForm(true) }}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded"
        >
          + Log Decision
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-gray-500 text-sm">Loading…</div>
        ) : decisions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-500 text-sm mb-1">No decisions logged yet</div>
            <div className="text-gray-600 text-xs">
              Log decisions here so they're searchable and never lost in a thread.
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-800">
            {decisions.map((d) => (
              <li key={d.id} data-testid="decision-item" className="px-4 py-3 hover:bg-gray-800/40 group">
                <div
                  className="cursor-pointer"
                  onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0 mt-1" />
                        <span className="text-sm text-gray-200 font-medium leading-tight">
                          {d.subject}
                        </span>
                      </div>
                      <p className={`text-sm text-gray-400 mt-1 ${expanded === d.id ? '' : 'line-clamp-2'}`}>
                        {d.outcome}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingDecision(d); setShowForm(true) }}
                        className="text-xs text-gray-400 hover:text-gray-200 px-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(d.id) }}
                        className="text-xs text-gray-400 hover:text-red-400 px-1"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 ml-3.5">
                    <span className="text-xs text-gray-500">
                      {new Date(d.decidedAt).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </span>
                    {d.decidedBy && (
                      <span className="text-xs text-gray-500">by {d.decidedBy}</span>
                    )}
                    {d.sourceThreadId && (
                      <span className="text-xs text-purple-400/70">from thread</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showForm && (
        <DecisionForm
          decision={editingDecision}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}

function DecisionForm({
  decision,
  onClose,
  onSaved,
}: {
  decision: Decision | null
  onClose: () => void
  onSaved: () => void
}) {
  const [subject, setSubject] = useState(decision?.subject ?? '')
  const [outcome, setOutcome] = useState(decision?.outcome ?? '')
  const [decidedBy, setDecidedBy] = useState(decision?.decidedBy ?? '')
  const [decidedAt, setDecidedAt] = useState(
    decision?.decidedAt ? decision.decidedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
  )
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !outcome.trim()) return
    setSaving(true)
    try {
      if (decision) {
        await updateDecision(decision.id, {
          subject: subject.trim(),
          outcome: outcome.trim(),
          decidedBy: decidedBy.trim() || undefined,
          decidedAt: decidedAt || undefined,
        })
      } else {
        await createDecision({
          subject: subject.trim(),
          outcome: outcome.trim(),
          decidedBy: decidedBy.trim() || undefined,
          decidedAt: decidedAt || undefined,
        })
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md mx-4 p-5">
        <h3 className="text-sm font-semibold text-gray-200 mb-1">
          {decision ? 'Edit Decision' : 'Log a Decision'}
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Capture the outcome so it's searchable and permanent.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">What was decided?</label>
            <input
              data-testid="decision-subject-input"
              autoFocus
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Pricing model for Q3"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Outcome</label>
            <textarea
              data-testid="decision-outcome-input"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="e.g. We will charge $49/mo per seat, billed annually. No freemium tier."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400 block mb-1">Decided by</label>
              <input
                value={decidedBy}
                onChange={(e) => setDecidedBy(e.target.value)}
                placeholder="Name or team (optional)"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 block mb-1">Date</label>
              <input
                type="date"
                value={decidedAt}
                onChange={(e) => setDecidedAt(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-gray-400 hover:text-gray-200 px-3 py-1.5">
              Cancel
            </button>
            <button
              data-testid="decision-save-button"
              type="submit"
              disabled={saving || !subject.trim() || !outcome.trim()}
              className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-1.5 rounded"
            >
              {saving ? 'Saving…' : decision ? 'Save' : 'Log Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
