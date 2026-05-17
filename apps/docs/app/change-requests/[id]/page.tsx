import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getCR, getCRNotes, getCRAttachments,
  updateCRStatus, updateCRPriority, updateCRAssignee, addCRNote, archiveCR,
  CR_STATUSES, STATUS_LABELS, PRIORITY_LABELS,
  type CRStatus, type CRPriority,
} from '@/lib/cr-actions'

export const dynamic = 'force-dynamic'

const PRIORITY_COLORS = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-orange-100 text-orange-700',
  medium: 'bg-blue-100 text-blue-600',
  low:    'bg-gray-100 text-gray-500',
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export default async function CRDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [cr, notes, attachments] = await Promise.all([
    getCR(id), getCRNotes(id), getCRAttachments(id),
  ])
  if (!cr) notFound()

  async function setStatus(formData: FormData) {
    'use server'
    await updateCRStatus(id, formData.get('status') as CRStatus)
  }
  async function setPriority(formData: FormData) {
    'use server'
    await updateCRPriority(id, formData.get('priority') as CRPriority)
  }
  async function setAssignee(formData: FormData) {
    'use server'
    await updateCRAssignee(id, formData.get('assigned_to') as string)
  }
  async function addNote(formData: FormData) {
    'use server'
    await addCRNote(id, formData)
  }
  async function doArchive() {
    'use server'
    await archiveCR(id)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/change-requests" className="text-gray-400 hover:text-gray-700 text-sm">← Board</Link>
        <div className="w-px h-4 bg-gray-200" />
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${PRIORITY_COLORS[cr.priority]}`}>
          {PRIORITY_LABELS[cr.priority]}
        </span>
        <span className="text-sm font-semibold text-gray-900 truncate">{cr.title}</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Meta controls */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
          <h2 className="font-semibold text-gray-800 text-base">{cr.title}</h2>
          {cr.description && (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{cr.description}</p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
            {/* Status */}
            <div>
              <p className="text-xs text-gray-400 mb-1">Status</p>
              <form action={setStatus}>
                <select
                  name="status"
                  defaultValue={cr.status}
                  className="text-sm border border-gray-200 rounded px-2 py-1 bg-white w-full"
                >
                  {CR_STATUSES.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <button type="submit" className="mt-1 text-xs text-blue-500 hover:underline">Save</button>
              </form>
            </div>

            {/* Priority */}
            <div>
              <p className="text-xs text-gray-400 mb-1">Priority</p>
              <form action={setPriority}>
                <select
                  name="priority"
                  defaultValue={cr.priority}
                  className="text-sm border border-gray-200 rounded px-2 py-1 bg-white w-full"
                >
                  {(['low','medium','high','urgent'] as CRPriority[]).map(p => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
                <button type="submit" className="mt-1 text-xs text-blue-500 hover:underline">Save</button>
              </form>
            </div>

            {/* Assignee */}
            <div>
              <p className="text-xs text-gray-400 mb-1">Assigned to</p>
              <form action={setAssignee}>
                <input
                  name="assigned_to"
                  type="text"
                  defaultValue={cr.assigned_to ?? ''}
                  placeholder="Unassigned"
                  className="text-sm border border-gray-200 rounded px-2 py-1 w-full"
                />
                <button type="submit" className="mt-1 text-xs text-blue-500 hover:underline">Save</button>
              </form>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2 border-t border-gray-100 text-xs text-gray-400">
            {cr.submitted_by && <span>Submitted by <strong className="text-gray-600">{cr.submitted_by}</strong></span>}
            <span>{fmt(cr.created_at)}</span>
            <form action={doArchive} className="ml-auto">
              <button type="submit" className="text-red-400 hover:text-red-600">Archive</button>
            </form>
          </div>
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Attachments</h3>
            <div className="flex flex-wrap gap-3">
              {attachments.map(att => (
                <a
                  key={att.id}
                  href={`/api/cr-attachments/${att.id}`}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center gap-2 text-xs text-blue-600 hover:underline border border-gray-200 rounded-lg px-3 py-2"
                >
                  <span>{att.mime_type.startsWith('image/') ? '🖼' : '📄'}</span>
                  <span>{att.filename}</span>
                  <span className="text-gray-400">({Math.round(att.byte_size / 1024)} KB)</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Notes thread */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Notes</h3>
          <div className="flex flex-col gap-3 mb-5">
            {notes.length === 0 && (
              <p className="text-xs text-gray-400 italic">No notes yet.</p>
            )}
            {notes.map(note => (
              <div key={note.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="font-medium text-gray-600">{note.author ?? 'Anonymous'}</span>
                  <span>{fmt(note.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2">
                  {note.body}
                </p>
              </div>
            ))}
          </div>

          <form action={addNote} className="flex flex-col gap-2">
            <input
              name="author"
              type="text"
              placeholder="Your name (optional)"
              className="text-sm border border-gray-200 rounded px-3 py-1.5 w-48"
            />
            <textarea
              name="body"
              rows={3}
              placeholder="Add a note…"
              required
              className="text-sm border border-gray-200 rounded px-3 py-2 resize-y"
            />
            <div>
              <button
                type="submit"
                className="text-sm bg-gray-800 text-white px-4 py-1.5 rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Add note
              </button>
            </div>
          </form>
        </div>

      </main>
    </div>
  )
}
