'use client'
import { useRouter } from 'next/navigation'
import { deleteSpreadsheet } from '@/lib/actions'

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      aria-label="Delete spreadsheet"
      className="text-fg-tertiary hover:text-danger px-2 py-3 transition-colors opacity-0 group-hover:opacity-100"
      onClick={async (e) => {
        e.stopPropagation()
        if (!confirm('Delete this spreadsheet?')) return
        await deleteSpreadsheet(id)
        router.refresh()
      }}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}
