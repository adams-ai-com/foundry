'use client'

import { useState, useRef, useEffect } from 'react'

type OWLChannel = { id: string; name: string }
type TeamsChannel = { teamId: string; teamName: string; channelId: string; channelName: string }
type ChanMap = { team_name: string; channel_name: string; foundry_channel_id: string | null; create_new: boolean; new_name: string | null; skip: boolean }

type RecentJob = {
  id: string; status: string; filename: string
  messages_imported: number; users_unmatched: number
  completed_at: string | null; created_at: string
}

type JobStatus = {
  status: string; messages_imported: number; users_unmatched: number
  attachments_unavailable: number; error_message: string | null; completed_at: string | null
}

interface Props {
  foundryChannels: OWLChannel[]
  recentJobs: RecentJob[]
}

type Step = 'upload' | 'channels' | 'options' | 'confirm' | 'running' | 'done'

export function TeamsImportWizard({ foundryChannels, recentJobs }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

  const [jobId, setJobId] = useState<string | null>(null)
  const [teamsChannels, setTeamsChannels] = useState<TeamsChannel[]>([])
  const [chanMapping, setChanMapping] = useState<Record<string, ChanMap>>({})
  const [autoMatched, setAutoMatched] = useState(0)
  const [totalUsers, setTotalUsers] = useState(0)
  const [includeSystemEvents, setIncludeSystemEvents] = useState(false)

  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/import/teams', { method: 'POST', body: form })
      const data = await res.json() as {
        jobId: string; channels: TeamsChannel[]
        channel_mapping: Record<string, ChanMap>
        auto_matched: number; users: { id: string }[]
        error?: string
      }
      if (!res.ok) { setUploadError(data.error ?? 'Upload failed'); return }
      setJobId(data.jobId)
      setTeamsChannels(data.channels)
      setChanMapping(data.channel_mapping)
      setAutoMatched(data.auto_matched)
      setTotalUsers(data.users.length)
      setStep('channels')
    } catch { setUploadError('Upload failed — check file and try again') }
    finally { setUploading(false) }
  }

  async function handleSaveMapping() {
    if (!jobId) return
    await fetch(`/api/import/teams/${jobId}/mapping`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        user_mapping: {},
        channel_mapping: chanMapping,
        include_system_events: includeSystemEvents,
      }),
    })
    setStep('confirm')
  }

  async function handleRun() {
    if (!jobId) return
    const res = await fetch(`/api/import/teams/${jobId}/run`, { method: 'POST' })
    if (!res.ok) return
    setStep('running')
    pollRef.current = setInterval(async () => {
      const r = await fetch(`/api/import/teams/${jobId}/status`)
      if (!r.ok) return
      const s = await r.json() as JobStatus
      setJobStatus(s)
      if (s.status === 'complete' || s.status === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current)
        setStep('done')
      }
    }, 2000)
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // Group channels by team for display
  const teamGroups = teamsChannels.reduce<Record<string, { teamName: string; channels: TeamsChannel[] }>>((acc, c) => {
    if (!acc[c.teamId]) acc[c.teamId] = { teamName: c.teamName, channels: [] }
    acc[c.teamId].channels.push(c)
    return acc
  }, {})

  const activeCount = teamsChannels.filter(c => !chanMapping[c.channelId]?.skip).length
  const skippedCount = teamsChannels.filter(c => chanMapping[c.channelId]?.skip).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-10 px-6">
        <div className="flex items-center gap-3 mb-8">
          <a href="/import" className="text-gray-400 hover:text-gray-600 text-sm">← Import</a>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">Microsoft Teams</span>
        </div>

        {/* Upload */}
        {step === 'upload' && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Import from Microsoft Teams</h1>
            <p className="text-gray-500 mb-2">Upload a Teams export ZIP from the Teams admin center or Microsoft Purview.</p>
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800 mb-6">
              <strong>How to export:</strong> Teams Admin Center → <em>Users → Data export</em>, or Microsoft Purview Compliance → <em>Content search → Export</em>.
              Conversation threads become individual topics in OWL Channels.
            </div>

            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-indigo-400 transition-colors cursor-pointer bg-white"
              onClick={() => fileRef.current?.click()}
            >
              <div className="text-5xl mb-4">📋</div>
              <p className="text-gray-700 font-medium">Click to choose a Teams export ZIP</p>
              <p className="text-gray-400 text-sm mt-1">Up to 110 MB</p>
              <input
                ref={fileRef} type="file" accept=".zip" className="hidden"
                onChange={e => setSelectedFileName(e.target.files?.[0]?.name ?? null)}
              />
            </div>
            {selectedFileName && <div className="mt-3 text-sm text-gray-600">Selected: {selectedFileName}</div>}
            {uploadError && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{uploadError}</div>
            )}
            <button onClick={handleUpload} disabled={uploading}
              className="mt-6 w-full bg-indigo-600 text-white font-medium py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {uploading ? 'Analyzing ZIP…' : 'Upload & Analyze'}
            </button>

            {recentJobs.length > 0 && (
              <div className="mt-10">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent imports</h2>
                <div className="space-y-2">
                  {recentJobs.map(j => (
                    <div key={j.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-800">{j.filename}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${j.status === 'complete' ? 'bg-green-100 text-green-700' : j.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {j.status}
                        </span>
                      </div>
                      {j.status === 'complete' && <span className="text-gray-400">{j.messages_imported.toLocaleString()} messages</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Channel mapping */}
        {step === 'channels' && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Map channels</h1>
            <p className="text-gray-500 mb-6">
              Found <strong>{teamsChannels.length}</strong> channel{teamsChannels.length !== 1 ? 's' : ''} across <strong>{Object.keys(teamGroups).length}</strong> team{Object.keys(teamGroups).length !== 1 ? 's' : ''}.
              Each channel's conversation threads become topics in OWL.
            </p>

            <div className="space-y-6">
              {Object.entries(teamGroups).map(([teamId, group]) => (
                <div key={teamId}>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group.teamName}</div>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {group.channels.map((c, idx) => {
                      const m = chanMapping[c.channelId] ?? { team_name: c.teamName, channel_name: c.channelName, foundry_channel_id: null, create_new: true, new_name: c.channelName, skip: false }
                      return (
                        <div key={c.channelId} className={`grid grid-cols-[1fr_auto_1fr] gap-4 items-center px-5 py-3 ${idx < group.channels.length - 1 ? 'border-b border-gray-50' : ''}`}>
                          <span className="font-medium text-gray-800">{c.channelName}</span>
                          <span className="text-gray-300">→</span>
                          <div className="flex flex-col gap-1">
                            <select
                              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-indigo-400"
                              value={m.skip ? '_skip' : m.foundry_channel_id ?? '_new'}
                              onChange={e => {
                                const v = e.target.value
                                setChanMapping(prev => ({
                                  ...prev,
                                  [c.channelId]: v === '_skip'
                                    ? { ...m, skip: true, foundry_channel_id: null, create_new: false }
                                    : v === '_new'
                                    ? { ...m, skip: false, foundry_channel_id: null, create_new: true, new_name: c.channelName }
                                    : { ...m, skip: false, foundry_channel_id: v, create_new: false }
                                }))
                              }}
                            >
                              <option value="_new">Create new: {c.channelName}</option>
                              {foundryChannels.map(fc => (
                                <option key={fc.id} value={fc.id}>Map to #{fc.name}</option>
                              ))}
                              <option value="_skip">Skip</option>
                            </select>
                            {m.create_new && !m.skip && (
                              <input
                                type="text"
                                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                                value={m.new_name ?? c.channelName}
                                onChange={e => setChanMapping(prev => ({
                                  ...prev,
                                  [c.channelId]: { ...m, new_name: e.target.value }
                                }))}
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <label className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={includeSystemEvents} onChange={e => setIncludeSystemEvents(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                <div>
                  <div className="font-medium text-gray-800 text-sm">Include system events</div>
                  <div className="text-xs text-gray-500 mt-0.5">Import "John joined the team" and similar activity messages. Off by default.</div>
                </div>
              </label>
            </div>

            <div className="mt-6 flex justify-between">
              <button onClick={() => setStep('upload')} className="text-gray-500 hover:text-gray-700 text-sm">← Back</button>
              <button onClick={handleSaveMapping}
                className="bg-indigo-600 text-white font-medium px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Confirm */}
        {step === 'confirm' && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Ready to import</h1>
            <p className="text-gray-500 mb-6">Review and start the import.</p>

            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              <div className="px-5 py-4">
                <div className="text-sm text-gray-500 mb-0.5">File</div>
                <div className="font-medium text-gray-900">{selectedFileName}</div>
              </div>
              <div className="px-5 py-4">
                <div className="text-sm text-gray-500 mb-0.5">Channels</div>
                <div className="font-medium text-gray-900">{activeCount} to import{skippedCount > 0 ? `, ${skippedCount} skipped` : ''}</div>
              </div>
              <div className="px-5 py-4">
                <div className="text-sm text-gray-500 mb-0.5">Threading</div>
                <div className="font-medium text-gray-900">Each conversation thread → one OWL topic</div>
              </div>
              <div className="px-5 py-4">
                <div className="text-sm text-gray-500 mb-0.5">Users</div>
                <div className="font-medium text-gray-900">{autoMatched} of {totalUsers} matched by display name</div>
                {totalUsers - autoMatched > 0 && (
                  <div className="text-sm text-gray-400">{totalUsers - autoMatched} unmatched — attributed to you as importer</div>
                )}
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-500">
              Import is idempotent — re-importing the same ZIP is safe.
            </div>

            <div className="mt-6 flex justify-between">
              <button onClick={() => setStep('channels')} className="text-gray-500 hover:text-gray-700 text-sm">← Back</button>
              <button onClick={handleRun}
                className="bg-green-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-green-700 transition-colors">
                Start Import
              </button>
            </div>
          </div>
        )}

        {/* Running */}
        {step === 'running' && (
          <div className="text-center py-16">
            <div className="text-6xl mb-6" style={{ display: 'inline-block', animation: 'spin 2s linear infinite' }}>⚙️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Importing…</h1>
            <p className="text-gray-500 mb-8">Threads are being created. This may take a few minutes.</p>
            {jobStatus && (
              <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 inline-block min-w-64">
                <div className="text-4xl font-bold text-indigo-600">{jobStatus.messages_imported.toLocaleString()}</div>
                <div className="text-sm text-gray-500 mt-1">messages imported</div>
              </div>
            )}
          </div>
        )}

        {/* Done */}
        {step === 'done' && jobStatus && (
          <div>
            {jobStatus.status === 'failed' ? (
              <div>
                <div className="text-5xl mb-4">❌</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Import failed</h1>
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-4">{jobStatus.error_message}</p>
                <button onClick={() => setStep('upload')} className="mt-6 text-indigo-600 hover:text-indigo-800 font-medium">Try again →</button>
              </div>
            ) : (
              <div>
                <div className="text-5xl mb-4">✅</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Import complete</h1>
                <p className="text-gray-500 mb-6">Your Teams history is now in OWL Channels, organized as topics.</p>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 text-center">
                    <div className="text-3xl font-bold text-gray-900">{jobStatus.messages_imported.toLocaleString()}</div>
                    <div className="text-sm text-gray-500 mt-1">messages imported</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 text-center">
                    <div className="text-3xl font-bold text-gray-900">{jobStatus.users_unmatched.toLocaleString()}</div>
                    <div className="text-sm text-gray-500 mt-1">unmatched users</div>
                  </div>
                  {jobStatus.attachments_unavailable > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 text-center col-span-2">
                      <div className="text-3xl font-bold text-gray-900">{jobStatus.attachments_unavailable.toLocaleString()}</div>
                      <div className="text-sm text-gray-500 mt-1">attachments without download URL</div>
                    </div>
                  )}
                </div>
                <a href="/channels"
                  className="inline-block bg-indigo-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors">
                  Go to Channels →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
