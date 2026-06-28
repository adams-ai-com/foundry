'use client'

import { useState, useEffect, useRef } from 'react'

type OWLChannel = { id: string; name: string }
type SlackUser = { id: string; name: string; email: string | null; is_bot: boolean }
type SlackChannel = { id: string; name: string; is_dm: boolean; purpose: string | null }
type ChanMap = { foundry_channel_id: string | null; create_new: boolean; new_name: string | null; skip: boolean }

type RecentJob = {
  id: string; status: string; filename: string
  messages_imported: number; users_unmatched: number
  completed_at: string | null; created_at: string
}

interface Props {
  foundryChannels: OWLChannel[]
  recentJobs: RecentJob[]
}

type Step = 'upload' | 'channels' | 'options' | 'confirm' | 'running' | 'done'

type JobStatus = {
  status: string; messages_imported: number; messages_total: number
  users_unmatched: number; attachments_unavailable: number
  error_message: string | null; completed_at: string | null
}

export function SlackImportWizard({ foundryChannels, recentJobs }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Job state
  const [jobId, setJobId] = useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = useState('')
  const [slackUsers, setSlackUsers] = useState<SlackUser[]>([])
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([])
  const [userMapping, setUserMapping] = useState<Record<string, string>>({})
  const [chanMapping, setChanMapping] = useState<Record<string, ChanMap>>({})
  const [autoMatched, setAutoMatched] = useState(0)
  const [includeDms, setIncludeDms] = useState(false)
  const [includeBots, setIncludeBots] = useState(false)

  // Running state
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Upload the ZIP
  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/import/slack', { method: 'POST', body: form })
      const data = await res.json() as {
        jobId: string; workspace_name: string; users: SlackUser[]
        channels: SlackChannel[]; user_mapping: Record<string, string>
        channel_mapping: Record<string, ChanMap>; auto_matched: number
        error?: string
      }
      if (!res.ok) { setUploadError(data.error ?? 'Upload failed'); return }
      setJobId(data.jobId)
      setWorkspaceName(data.workspace_name)
      setSlackUsers(data.users)
      setSlackChannels(data.channels)
      setUserMapping(data.user_mapping)
      setChanMapping(data.channel_mapping)
      setAutoMatched(data.auto_matched)
      setStep('channels')
    } catch (e) {
      setUploadError('Upload failed — check file and try again')
    } finally {
      setUploading(false)
    }
  }

  // Save mapping and move to options
  async function handleSaveChannels() {
    setStep('options')
  }

  // Save options and move to confirm
  async function handleSaveOptions() {
    if (!jobId) return
    await fetch(`/api/import/slack/${jobId}/mapping`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_mapping: userMapping, channel_mapping: chanMapping, include_dms: includeDms, include_bots: includeBots }),
    })
    setStep('confirm')
  }

  // Start import
  async function handleRun() {
    if (!jobId) return
    const res = await fetch(`/api/import/slack/${jobId}/run`, { method: 'POST' })
    if (!res.ok) return
    setStep('running')
    pollRef.current = setInterval(async () => {
      const r = await fetch(`/api/import/slack/${jobId}/status`)
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

  const nonDmChannels = slackChannels.filter(c => !c.is_dm)
  const dmChannels = slackChannels.filter(c => c.is_dm)
  const activeChannels = nonDmChannels.filter(c => !chanMapping[c.id]?.skip)
  const skippedChannels = nonDmChannels.filter(c => chanMapping[c.id]?.skip)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-10 px-6">
        <div className="flex items-center gap-3 mb-8">
          <a href="/import" className="text-gray-400 hover:text-gray-600 text-sm">← Import</a>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">Slack</span>
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Import from Slack</h1>
            <p className="text-gray-500 mb-6">Upload a Slack export ZIP. Go to <strong>Slack → Settings → Import/Export</strong> to download one.</p>

            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-indigo-400 transition-colors cursor-pointer bg-white"
              onClick={() => fileRef.current?.click()}
            >
              <div className="text-5xl mb-4">📦</div>
              <p className="text-gray-700 font-medium">Click to choose a Slack export ZIP</p>
              <p className="text-gray-400 text-sm mt-1">Up to 110 MB</p>
              <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={() => {}} />
            </div>

            {fileRef.current?.files?.[0] && (
              <div className="mt-3 text-sm text-gray-600">Selected: {fileRef.current.files[0].name}</div>
            )}

            {uploadError && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{uploadError}</div>
            )}

            <button
              onClick={handleUpload}
              disabled={uploading}
              className="mt-6 w-full bg-indigo-600 text-white font-medium py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
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
                      {j.status === 'complete' && (
                        <span className="text-gray-400">{j.messages_imported.toLocaleString()} messages</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Channel mapping */}
        {step === 'channels' && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Map channels</h1>
            <p className="text-gray-500 mb-6">Found <strong>{nonDmChannels.length}</strong> channels in <em>{workspaceName}</em>. Choose where each one goes.</p>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-0 text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3 border-b border-gray-100 bg-gray-50">
                <span>Slack channel</span>
                <span></span>
                <span>OWL channel</span>
              </div>
              {nonDmChannels.map(c => {
                const m = chanMapping[c.id] ?? { foundry_channel_id: null, create_new: true, new_name: c.name, skip: false }
                return (
                  <div key={c.id} className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center px-5 py-3 border-b border-gray-50 last:border-0">
                    <div>
                      <span className="font-medium text-gray-800">#{c.name}</span>
                      {c.purpose && <div className="text-xs text-gray-400 mt-0.5 truncate">{c.purpose}</div>}
                    </div>
                    <span className="text-gray-300">→</span>
                    <div className="flex flex-col gap-1">
                      <select
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-indigo-400"
                        value={m.skip ? '_skip' : m.foundry_channel_id ?? '_new'}
                        onChange={e => {
                          const v = e.target.value
                          setChanMapping(prev => ({
                            ...prev,
                            [c.id]: v === '_skip'
                              ? { foundry_channel_id: null, create_new: false, new_name: null, skip: true }
                              : v === '_new'
                              ? { foundry_channel_id: null, create_new: true, new_name: c.name, skip: false }
                              : { foundry_channel_id: v, create_new: false, new_name: null, skip: false }
                          }))
                        }}
                      >
                        <option value="_new">Create new: #{c.name}</option>
                        {foundryChannels.map(fc => (
                          <option key={fc.id} value={fc.id}>Map to #{fc.name}</option>
                        ))}
                        <option value="_skip">Skip</option>
                      </select>
                      {m.create_new && !m.skip && (
                        <input
                          type="text"
                          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                          placeholder="Channel name"
                          value={m.new_name ?? c.name}
                          onChange={e => setChanMapping(prev => ({
                            ...prev,
                            [c.id]: { ...m, new_name: e.target.value }
                          }))}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 flex justify-between">
              <button onClick={() => setStep('upload')} className="text-gray-500 hover:text-gray-700 text-sm">← Back</button>
              <button onClick={handleSaveChannels}
                className="bg-indigo-600 text-white font-medium px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step: Options */}
        {step === 'options' && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Import options</h1>
            <p className="text-gray-500 mb-6">Configure what to include in the import.</p>

            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              <label className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={includeDms} onChange={e => setIncludeDms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                <div>
                  <div className="font-medium text-gray-800">Include Direct Messages</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    Found {dmChannels.length} DM thread{dmChannels.length !== 1 ? 's' : ''}. Requires explicit opt-in for privacy.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={includeBots} onChange={e => setIncludeBots(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                <div>
                  <div className="font-medium text-gray-800">Include bot messages</div>
                  <div className="text-sm text-gray-500 mt-0.5">Import messages sent by Slack bots and integrations. Off by default.</div>
                </div>
              </label>
            </div>

            <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm">
              <div className="font-semibold text-blue-800 mb-1">User matching</div>
              <div className="text-blue-700">
                {slackUsers.length} Slack users found. <strong>{autoMatched}</strong> auto-matched by email.{' '}
                {slackUsers.length - autoMatched > 0 && (
                  <span>{slackUsers.length - autoMatched} unmatched — their messages will be attributed to you as importer.</span>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button onClick={() => setStep('channels')} className="text-gray-500 hover:text-gray-700 text-sm">← Back</button>
              <button onClick={handleSaveOptions}
                className="bg-indigo-600 text-white font-medium px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Ready to import</h1>
            <p className="text-gray-500 mb-6">Review the summary below, then start the import.</p>

            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              <div className="px-5 py-4">
                <div className="text-sm text-gray-500 mb-0.5">Source</div>
                <div className="font-medium text-gray-900">{workspaceName} · {fileRef.current?.files?.[0]?.name}</div>
              </div>
              <div className="px-5 py-4">
                <div className="text-sm text-gray-500 mb-0.5">Channels to import</div>
                <div className="font-medium text-gray-900">{activeChannels.length} channels</div>
                {skippedChannels.length > 0 && <div className="text-sm text-gray-400">{skippedChannels.length} skipped</div>}
              </div>
              <div className="px-5 py-4">
                <div className="text-sm text-gray-500 mb-0.5">Users</div>
                <div className="font-medium text-gray-900">{autoMatched} of {slackUsers.length} matched by email</div>
              </div>
              <div className="px-5 py-4">
                <div className="text-sm text-gray-500 mb-0.5">Options</div>
                <div className="text-sm text-gray-700 space-y-0.5">
                  <div>{includeDms ? '✓ DMs included' : '✗ DMs excluded'}</div>
                  <div>{includeBots ? '✓ Bot messages included' : '✗ Bot messages excluded'}</div>
                </div>
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-500">
              Import is idempotent — re-importing the same ZIP won't create duplicates.
            </div>

            <div className="mt-6 flex justify-between">
              <button onClick={() => setStep('options')} className="text-gray-500 hover:text-gray-700 text-sm">← Back</button>
              <button onClick={handleRun}
                className="bg-green-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-green-700 transition-colors">
                Start Import
              </button>
            </div>
          </div>
        )}

        {/* Step: Running */}
        {step === 'running' && (
          <div className="text-center py-16">
            <div className="text-6xl mb-6 animate-spin" style={{ animationDuration: '2s', display: 'inline-block' }}>⚙️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Importing…</h1>
            <p className="text-gray-500 mb-8">This may take a few minutes for large exports.</p>
            {jobStatus && (
              <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 inline-block min-w-64">
                <div className="text-4xl font-bold text-indigo-600">{jobStatus.messages_imported.toLocaleString()}</div>
                <div className="text-sm text-gray-500 mt-1">messages imported</div>
              </div>
            )}
          </div>
        )}

        {/* Step: Done */}
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
                <p className="text-gray-500 mb-6">Your Slack history is now in OWL Channels.</p>
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
                      <div className="text-sm text-gray-500 mt-1">file attachments unavailable</div>
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-500 mb-6">
                  Messages are now searchable in Channels. Run the{' '}
                  <a href="/channels" className="text-indigo-600 hover:underline">embed backfill</a>{' '}
                  from your org settings to make them available in Communication Memory search.
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
