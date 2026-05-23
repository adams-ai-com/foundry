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
        className="text-fg-tertiary hover:text-danger px-3 py-3 transition-colors opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          if (!confirm('Delete this document?')) e.preventDefault()
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </form>
  )
}
