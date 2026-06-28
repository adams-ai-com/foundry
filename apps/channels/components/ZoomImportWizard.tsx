'use client'

import { useState, useRef, useCallback } from 'react'

type Channel = { id: string; name: string }
type Topic = { id: string; name: string }

type RecordingRow = {
  id: string
  title: string
  recorded_at: string | null
  vtt_path: string | null
  mp4_path: string | null
  channel_id: string | null
  topic_id: string | null
  status: 'pending' | 'processing' | 'done' | 'failed'
  call_id: string | null
  error: string | null
}

type RecentJob = {
  id: string; status: string; total: number; processed: number
  error_message: string | null; created_at: string
}

type Step = 'upload' | 'map' | 'running' | 'done'

export function ZoomImportWizard({
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
  const [recordings, setRecordings] = useState<RecordingRow[]>([])
  // Per-recording channel/topic overrides
  const [mappings, setMappings] = useState<Record<string, { channel_id: string | null; topic_id: string | null }>>({})
  const [topics, setTopics] = useState<Record<string, Topic[]>>({}) // channelId → topics
  const [runStatus, setRunStatus] = useState<RecordingRow[]>([])
  const [jobStatus, setJobStatus] = useState<string>('running')
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Upload ──────────────────────────────────────────────────────────────

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f =>
      /\.(vtt|mp4|m4a)$/i.test(f.name)
    )
    if (!arr.length) {
      setUploadError('Please select .vtt, .mp4, or .m4a files from your Zoom export.')
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      arr.forEach(f => form.append('files', f))
      const res = await fetch('/api/import/zoom', { method: 'POST', body: form })
      if (!res.ok) {
        const { error } = await res.json() as { error: string }
        throw new Error(error)
      }
      const data = await res.json() as { jobId: string; recordings: RecordingRow[] }
      setJobId(data.jobId)
      setRecordings(data.recordings)
      const initMappings: typeof mappings = {}
      data.recordings.forEach(r => { initMappings[r.id] = { channel_id: null, topic_id: null } })
      setMappings(initMappings)
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
    void handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  // ── Channel/topic mapping ──────────────────────────────────────────────

  const fetchTopics = useCallback(async (channelId: string) => {
    if (topics[channelId]) return
    const res = await fetch(`/api/channels/${channelId}/topics`)
    if (res.ok) {
      const data = await res.json() as Topic[]
      setTopics(prev => ({ ...prev, [channelId]: data }))
    }
  }, [topics])

  const setMapping = useCallback((recId: string, field: 'channel_id' | 'topic_id', value: string | null) => {
    setMappings(prev => {
      const m = { ...prev[recId] }
      if (field === 'channel_id') {
        m.channel_id = value
        m.topic_id = null // reset topic when channel changes
        if (value) void fetchTopics(value)
      } else {
        m.topic_id = value
      }
      return { ...prev, [recId]: m }
    })
  }, [fetchTopics])

  // ── Run ────────────────────────────────────────────────────────────────

  const startImport = useCallback(async () => {
    if (!jobId) return
    // Save mappings
    await fetch(`/api/import/zoom/${jobId}/mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mappings: recordings.map(r => ({
          id: r.id,
          channel_id: mappings[r.id]?.channel_id ?? null,
          topic_id: mappings[r.id]?.topic_id ?? null,
        })),
      }),
    })
    // Start import
    await fetch(`/api/import/zoom/${jobId}/run`, { method: 'POST' })
    setStep('running')
    setRunStatus(recordings.map(r => ({ ...r, status: 'pending' })))

    // Poll status
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/import/zoom/${jobId}/status`)
      if (!res.ok) return
      const data = await res.json() as {
        status: string
        recordings: RecordingRow[]
        total: number
        processed: number
      }
      setRunStatus(data.recordings ?? [])
      setJobStatus(data.status)
      if (data.status === 'complete' || data.status === 'partial' || data.status === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current)
        setStep('done')
      }
    }, 2500)
  }, [jobId, mappings, recordings])

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="mb-6">
          <a href="/import" className="text-sm text-indigo-600 hover:underline">← Back to imports</a>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Import Zoom Recordings</h1>
        <p className="text-gray-500 text-sm mb-6">
          Upload VTT transcript files (and optionally MP4s under 25 MB) from your Zoom downloads.
          Transcripts will be processed and summaries generated automatically.
        </p>

        {/* Steps indicator */}
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
              <span className="text-4xl mb-3 block">🎥</span>
              <p className="text-gray-700 font-medium">Drop Zoom files here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">Accepts .vtt, .mp4, .m4a — upload multiple at once</p>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".vtt,.mp4,.m4a"
                multiple
                onChange={e => e.target.files && void handleFiles(e.target.files)}
              />
            </div>
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-indigo-600 justify-center">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Uploading and parsing files…
              </div>
            )}
            {uploadError && <p className="text-sm text-red-600 text-center">{uploadError}</p>}

            {recentJobs.length > 0 && (
              <div className="mt-8">
                <h2 className="text-sm font-medium text-gray-700 mb-2">Recent imports</h2>
                <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {recentJobs.map(j => (
                    <div key={j.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-gray-600">{new Date(j.created_at).toLocaleDateString()}</span>
                      <span className="text-gray-500">{j.processed}/{j.total} recordings</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        j.status === 'complete' ? 'bg-green-100 text-green-700'
                        : j.status === 'partial' ? 'bg-yellow-100 text-yellow-700'
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

        {/* Step: Map channels/topics */}
        {step === 'map' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Found <strong>{recordings.length}</strong> recording{recordings.length !== 1 ? 's' : ''}.
              Optionally assign each to an OWL channel and topic so the AI summary gets posted there.
            </p>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {recordings.map(r => {
                const m = mappings[r.id] ?? { channel_id: null, topic_id: null }
                const channelTopics = m.channel_id ? (topics[m.channel_id] ?? []) : []
                return (
                  <div key={r.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{r.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {r.recorded_at ? new Date(r.recorded_at).toLocaleString() : 'Date unknown'}
                          {r.vtt_path && <span className="ml-2 text-green-600">✓ transcript</span>}
                          {r.mp4_path && <span className="ml-2 text-blue-600">✓ video</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
                        value={m.channel_id ?? ''}
                        onChange={e => setMapping(r.id, 'channel_id', e.target.value || null)}
                      >
                        <option value="">No channel</option>
                        {foundryChannels.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {m.channel_id && (
                        <select
                          className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
                          value={m.topic_id ?? ''}
                          onChange={e => setMapping(r.id, 'topic_id', e.target.value || null)}
                        >
                          <option value="">No topic</option>
                          {channelTopics.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep('upload')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back
              </button>
              <button
                onClick={() => void startImport()}
                className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 font-medium"
              >
                Import {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {/* Step: Running */}
        {step === 'running' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 text-center">
              Importing — this may take a few minutes per recording for AI processing…
            </p>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {runStatus.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-lg">
                    {r.status === 'done' ? '✅' : r.status === 'failed' ? '❌' : r.status === 'processing' ? '⏳' : '⬜'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                    {r.error && <p className="text-xs text-red-500 mt-0.5 truncate">{r.error}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    r.status === 'done' ? 'bg-green-100 text-green-700'
                    : r.status === 'failed' ? 'bg-red-100 text-red-700'
                    : r.status === 'processing' ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-400'
                  }`}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className={`rounded-xl p-5 text-center ${
              jobStatus === 'complete' ? 'bg-green-50 border border-green-200'
              : jobStatus === 'partial' ? 'bg-yellow-50 border border-yellow-200'
              : 'bg-red-50 border border-red-200'
            }`}>
              <span className="text-4xl block mb-2">
                {jobStatus === 'complete' ? '🎉' : jobStatus === 'partial' ? '⚠️' : '❌'}
              </span>
              <p className="font-semibold text-gray-900">
                {jobStatus === 'complete' ? 'Import complete!'
                : jobStatus === 'partial' ? 'Import finished with some errors'
                : 'Import failed'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {runStatus.filter(r => r.status === 'done').length} of {runStatus.length} recordings imported
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {runStatus.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-lg">{r.status === 'done' ? '✅' : '❌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                    {r.error && <p className="text-xs text-red-500 mt-0.5">{r.error}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <a href="/import" className="flex-1 text-center px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">
                Back to imports
              </a>
              <button
                onClick={() => {
                  setStep('upload')
                  setRecordings([])
                  setJobId(null)
                  setRunStatus([])
                  setMappings({})
                }}
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
