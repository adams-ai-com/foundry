'use client'
import { useRouter } from 'next/navigation'
import { deleteSpreadsheet } from '@/lib/actions'

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      aria-label="Delete spreadsheet"
      className="text-gray-300 hover:text-red-500 px-2 py-3 transition-colors opacity-0 group-hover:opacity-100"
      onClick={async (e) => {
        e.stopPropagation()
        if (!confirm('Delete this spreadsheet?')) return
        await deleteSpreadsheet(id)
        router.refresh()
      }}
    >
      ✕
    </button>
  )
}
