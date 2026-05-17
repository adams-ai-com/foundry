'use client'

import { deleteDocument } from '@/lib/actions'

export function DeleteButton({ docId }: { docId: string }) {
  const deleteWithId = deleteDocument.bind(null, docId)
  return (
    <form action={deleteWithId}>
      <button
        type="submit"
        aria-label="Delete document"
        data-testid="delete-doc"
        className="text-gray-300 hover:text-red-500 px-2 py-3 transition-colors opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          if (!confirm('Delete this document?')) e.preventDefault()
        }}
      >
        ✕
      </button>
    </form>
  )
}
