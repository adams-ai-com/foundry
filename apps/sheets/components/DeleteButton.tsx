'use client'
import { deleteSpreadsheet } from '@/lib/actions'

export function DeleteButton({ id }: { id: string }) {
  const del = deleteSpreadsheet.bind(null, id)
  return (
    <form action={del}>
      <button
        type="submit"
        aria-label="Delete spreadsheet"
        className="text-gray-300 hover:text-red-500 px-2 py-3 transition-colors opacity-0 group-hover:opacity-100"
        onClick={(e) => { if (!confirm('Delete this spreadsheet?')) e.preventDefault() }}
      >
        ✕
      </button>
    </form>
  )
}
