import Link from 'next/link'
import { listCRs } from '@/lib/cr-actions'
import { CR_STATUSES, STATUS_LABELS, PRIORITY_LABELS, type CR, type CRStatus } from '@/lib/cr-types'

export const dynamic = 'force-dynamic'

const PRIORITY_COLORS = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-orange-100 text-orange-700',
  medium: 'bg-blue-100 text-blue-600',
  low:    'bg-gray-100 text-gray-500',
}

function age(ts: string): string {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d}d ago`
}

function CRCard({ cr }: { cr: CR }) {
  return (
    <Link
      href={`/change-requests/${cr.id}`}
      className="block bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-800 leading-snug">{cr.title}</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_COLORS[cr.priority]}`}>
          {PRIORITY_LABELS[cr.priority]}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
        {cr.submitted_by && <span>{cr.submitted_by}</span>}
        <span>{age(cr.created_at)}</span>
        {cr.assigned_to && <span className="ml-auto">→ {cr.assigned_to}</span>}
      </div>
    </Link>
  )
}

function Column({ status, crs }: { status: CRStatus; crs: CR[] }) {
  const HEADER_COLORS: Record<CRStatus, string> = {
    backlog:     'border-gray-300',
    up_next:     'border-indigo-400',
    in_progress: 'border-blue-500',
    in_review:   'border-amber-400',
    blocked:     'border-red-400',
    done:        'border-green-500',
  }
  return (
    <div className="flex flex-col min-w-[220px] w-full">
      <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${HEADER_COLORS[status]}`}>
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {STATUS_LABELS[status]}
        </span>
        <span className="text-xs text-gray-400">{crs.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {crs.map(cr => <CRCard key={cr.id} cr={cr} />)}
        {crs.length === 0 && (
          <p className="text-xs text-gray-300 italic px-1">Empty</p>
        )}
      </div>
    </div>
  )
}

export default async function CRBoardPage() {
  const crs = await listCRs()
  const byStatus = Object.fromEntries(
    CR_STATUSES.map(s => [s, crs.filter(cr => cr.status === s)])
  ) as Record<CRStatus, CR[]>

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm">← Sheets</Link>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">CR</span>
            </div>
            <span className="font-semibold text-gray-900">Change Requests</span>
          </div>
        </div>
        <span className="text-xs text-gray-400">{crs.length} open</span>
      </header>

      <main className="flex-1 overflow-x-auto px-6 py-6">
        <div className="flex gap-4 min-w-max">
          {CR_STATUSES.filter(s => s !== 'done').map(s => (
            <div key={s} className="w-56">
              <Column status={s} crs={byStatus[s]} />
            </div>
          ))}
        </div>

        {byStatus.done.length > 0 && (
          <div className="mt-8 max-w-xl">
            <Column status="done" crs={byStatus.done} />
          </div>
        )}
      </main>
    </div>
  )
}
