'use client'

import { useState, useRef, useCallback } from 'react'

type Channel = { id: string; name: string }

type GChatSpace = {
  id: string
  name: string
  type: 'SPACE' | 'GROUP_DIRECT_MESSAGE' | 'DIRECT_MESSAGE' | 'unknown'
  infoFile: string
  messagesFile: string
}

type GChatUser = { email: string; name: string }

type SpaceMappingEntry = {
  space_name: string
  space_type: string
  foundry_channel_id: string | null
  create_new: boolean
  new_name: string | null
  skip: boolean
}

type RecentJob = {
  id: string; status: string; filename: string | null
  messages_imported: number; users_unmatched: number
  completed_at: string | null; created_at: string
}

type Step = 'upload' | 'map' | 'running' | 'done'

export function GChatImportWizard({
  foundryChannels,
  recentJobs,
}: {
  foundryChannels: Channel[]
  recentJobs: RecentJob[]
}) {
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [jobId, setJobId] = useState<string | null>(null)
  const [spaces, setSpaces] = useState<GChatSpace[]>([])
  const [users, setUsers] = useState<GChatUser[]>([])
  const [userMapping, setUserMapping] = useState<Record<string, string>>({})
  const [spaceMapping, setSpaceMapping] = useState<Record<string, SpaceMappingEntry>>({})
  const [includeBots, setIncludeBots] = useState(false)
  const [availableChannels] = useState<Channel[]>(foundryChannels)

  const [runStatus, setRunStatus] = useState<{
    status: string; messages_imported: number; users_unmatched: number
    attachments_unavailable: number; error_message: string | null
  } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Upload ──────────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setUploadError('Please select a .zip file from Google Takeout.')
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/import/gchat', { method: 'POST', body: form })
      if (!res.ok) {
        const { error } = await res.json() as { error: string }
        throw new Error(error)
      }
      const data = await res.json() as {
        jobId: string
        spaces: GChatSpace[]
        users: GChatUser[]
        user_mapping: Record<string, string>
        space_mapping: Record<string, SpaceMappingEntry>
        auto_matched: number
        foundry_channels: Channel[]
      }
      setJobId(data.jobId)
      setSpaces(data.spaces)
      setUsers(data.users)
      setUserMapping(data.user_mapping)
      setSpaceMapping(data.space_mapping)
      setStep('map')
    } catch (err) {
      setUploadError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }, [handleFile])

  // ── Space mapping helpers ──────────────────────────────────────────────

  const updateSpaceMapping = (spaceId: string, patch: Partial<SpaceMappingEntry>) => {
    setSpaceMapping(prev => ({ ...prev, [spaceId]: { ...prev[spaceId], ...patch } }))
  }

  // ── Run ────────────────────────────────────────────────────────────────

  const startImport = useCallback(async () => {
    if (!jobId) return
    await fetch(`/api/import/gchat/${jobId}/mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_mapping: userMapping, space_mapping: spaceMapping, include_bots: includeBots }),
    })
    await fetch(`/api/import/gchat/${jobId}/run`, { method: 'POST' })
    setStep('running')

    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/import/gchat/${jobId}/status`)
      if (!res.ok) return
      const data = await res.json() as {
        status: string; messages_imported: number; users_unmatched: number
        attachments_unavailable: number; error_message: string | null
      }
      setRunStatus(data)
      if (data.status === 'complete' || data.status === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current)
        setStep('done')
      }
    }, 2500)
  }, [jobId, userMapping, spaceMapping, includeBots])

  const activeSpaces = spaces.filter(s => !spaceMapping[s.id]?.skip)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="mb-6">
          <a href="/import" className="text-sm text-indigo-600 hover:underline">← Back to imports</a>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Import Google Chat</h1>
        <p className="text-gray-500 text-sm mb-6">
          Upload a Google Takeout ZIP containing your Google Chat history.
          Get it at <span className="font-mono text-xs bg-gray-100 px-1 rounded">takeout.google.com</span> — select "Google Chat" only.
        </p>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          {(['upload', 'map', 'running', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-gray-300" />}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                step === s ? 'bg-indigo-600 text-white'
                : (['upload', 'map', 'running', 'done'].indexOf(step) > i)
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {s === 'upload' ? '1. Upload' : s === 'map' ? '2. Map' : s === 'running' ? '3. Import' : '4. Done'}
              </span>
            </div>
          ))}
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-300 bg-white'
              }`}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <span className="text-4xl mb-3 block">🔵</span>
              <p className="text-gray-700 font-medium">Drop Google Takeout ZIP here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">One .zip file from takeout.google.com</p>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".zip"
                onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
              />
            </div>
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-indigo-600 justify-center">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Uploading and scanning ZIP…
              </div>
            )}
            {uploadError && <p className="text-sm text-red-600 text-center">{uploadError}</p>}

            {recentJobs.length > 0 && (
              <div className="mt-8">
                <h2 className="text-sm font-medium text-gray-700 mb-2">Recent imports</h2>
                <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {recentJobs.map(j => (
                    <div key={j.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-gray-600 truncate max-w-[200px]">{j.filename ?? 'Unknown file'}</span>
                      <span className="text-gray-500 shrink-0 mx-2">{j.messages_imported.toLocaleString()} msgs</span>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                        j.status === 'complete' ? 'bg-green-100 text-green-700'
                        : j.status === 'failed' ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>{j.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Map */}
        {step === 'map' && (
          <div className="space-y-5">
            {/* Spaces */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">
                Spaces ({spaces.length} found)
              </h2>
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {spaces.map(s => {
                  const m = spaceMapping[s.id]
                  const isDm = s.type === 'DIRECT_MESSAGE' || s.type === 'GROUP_DIRECT_MESSAGE'
                  return (
                    <div key={s.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-medium text-gray-900 text-sm">{s.name}</span>
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${
                            isDm ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'
                          }`}>{isDm ? 'DM' : 'Space'}</span>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!m?.skip}
                            onChange={e => updateSpaceMapping(s.id, { skip: !e.target.checked })}
                          />
                          Import
                        </label>
                      </div>
                      {!m?.skip && (
                        <div className="flex gap-2 mt-2">
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="radio"
                              name={`mode-${s.id}`}
                              checked={!!m?.create_new}
                              onChange={() => updateSpaceMapping(s.id, { create_new: true, foundry_channel_id: null })}
                            />
                            New channel:
                          </label>
                          {m?.create_new && (
                            <input
                              type="text"
                              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
                              value={m.new_name ?? s.name}
                              onChange={e => updateSpaceMapping(s.id, { new_name: e.target.value })}
                            />
                          )}
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="radio"
                              name={`mode-${s.id}`}
                              checked={!m?.create_new}
                              onChange={() => updateSpaceMapping(s.id, { create_new: false })}
                            />
                            Existing:
                          </label>
                          {!m?.create_new && (
                            <select
                              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                              value={m?.foundry_channel_id ?? ''}
                              onChange={e => updateSpaceMapping(s.id, { foundry_channel_id: e.target.value || null })}
                            >
                              <option value="">— pick channel —</option>
                              {availableChannels.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* User mapping */}
            {users.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-2">
                  Users ({users.length}) — {Object.keys(userMapping).length} auto-matched by email
                </h2>
                <p className="text-xs text-gray-400 mb-2">
                  Unmatched users will appear by name with their Google email. You can re-import later after adding them.
                </p>
              </div>
            )}

            {/* Options */}
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={includeBots} onChange={e => setIncludeBots(e.target.checked)} />
              Include bot messages
            </label>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep('upload')} className="text-sm text-gray-500 hover:text-gray-700">
                ← Back
              </button>
              <button
                disabled={activeSpaces.length === 0}
                onClick={() => void startImport()}
                className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
              >
                Import {activeSpaces.length} space{activeSpaces.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {/* Step: Running */}
        {step === 'running' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <p className="text-gray-700 font-medium">Importing Google Chat history…</p>
              {runStatus && (
                <p className="text-sm text-gray-500 mt-1">
                  {runStatus.messages_imported.toLocaleString()} messages imported
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && runStatus && (
          <div className="space-y-4">
            <div className={`rounded-xl p-5 text-center ${
              runStatus.status === 'complete'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <span className="text-4xl block mb-2">{runStatus.status === 'complete' ? '🎉' : '❌'}</span>
              <p className="font-semibold text-gray-900">
                {runStatus.status === 'complete' ? 'Import complete!' : 'Import failed'}
              </p>
              {runStatus.status === 'complete' && (
                <div className="mt-2 text-sm text-gray-600 space-y-1">
                  <p><strong>{runStatus.messages_imported.toLocaleString()}</strong> messages imported</p>
                  {runStatus.users_unmatched > 0 && (
                    <p className="text-yellow-700">{runStatus.users_unmatched} messages from unmatched users</p>
                  )}
                  {runStatus.attachments_unavailable > 0 && (
                    <p className="text-gray-400">{runStatus.attachments_unavailable} file attachments noted (not downloaded)</p>
                  )}
                </div>
              )}
              {runStatus.error_message && (
                <p className="text-sm text-red-600 mt-2">{runStatus.error_message}</p>
              )}
            </div>
            <div className="flex gap-3">
              <a href="/import" className="flex-1 text-center px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">
                Back to imports
              </a>
              <button
                onClick={() => { setStep('upload'); setJobId(null); setSpaces([]); setUsers([]); setRunStatus(null) }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
              >
                Import more
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
