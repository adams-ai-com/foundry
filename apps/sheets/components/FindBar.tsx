'use client'

interface FindBarProps {
  query: string
  replace: string
  matchIndex: number
  matchCount: number
  onQueryChange: (q: string) => void
  onReplaceChange: (r: string) => void
  onPrev: () => void
  onNext: () => void
  onReplace: () => void
  onReplaceAll: () => void
  onClose: () => void
}

export function FindBar({
  query, replace, matchIndex, matchCount,
  onQueryChange, onReplaceChange,
  onPrev, onNext, onReplace, onReplaceAll, onClose,
}: FindBarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-bg-raised shrink-0">
      <span className="text-fg-tertiary text-xs font-medium shrink-0">Find</span>
      <input
        autoFocus
        data-testid="find-input"
        className="w-40 px-2 py-0.5 text-xs border border-border rounded bg-bg-surface text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent"
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.shiftKey ? onPrev() : onNext() }
          if (e.key === 'Escape') onClose()
        }}
        placeholder="Search…"
      />
      {matchCount > 0 && (
        <span className="text-xs text-fg-tertiary shrink-0 tabular-nums">
          {matchIndex + 1} / {matchCount}
        </span>
      )}
      {query && matchCount === 0 && (
        <span className="text-xs text-danger shrink-0">No results</span>
      )}
      <button
        onClick={onPrev}
        disabled={matchCount === 0}
        className="p-0.5 rounded hover:bg-bg-hover disabled:opacity-30 text-fg-secondary transition-colors"
        title="Previous (Shift+Enter)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/>
        </svg>
      </button>
      <button
        onClick={onNext}
        disabled={matchCount === 0}
        className="p-0.5 rounded hover:bg-bg-hover disabled:opacity-30 text-fg-secondary transition-colors"
        title="Next (Enter)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      <div className="w-px h-4 bg-border shrink-0" />

      <span className="text-fg-tertiary text-xs font-medium shrink-0">Replace</span>
      <input
        data-testid="replace-input"
        className="w-36 px-2 py-0.5 text-xs border border-border rounded bg-bg-surface text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent"
        value={replace}
        onChange={e => onReplaceChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
        placeholder="Replace with…"
      />
      <button
        onClick={onReplace}
        disabled={matchCount === 0}
        className="px-2 py-0.5 text-xs rounded bg-bg-surface border border-border hover:bg-bg-hover disabled:opacity-30 text-fg-secondary transition-colors"
      >
        Replace
      </button>
      <button
        onClick={onReplaceAll}
        disabled={matchCount === 0}
        className="px-2 py-0.5 text-xs rounded bg-bg-surface border border-border hover:bg-bg-hover disabled:opacity-30 text-fg-secondary transition-colors"
      >
        All
      </button>

      <button
        onClick={onClose}
        className="ml-auto p-0.5 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary transition-colors"
        title="Close (Escape)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}
