'use client'

interface ShortcutsModalProps {
  onClose: () => void
}

const SHORTCUTS = [
  { section: 'Navigation' },
  { key: 'j', desc: 'Next thread' },
  { key: 'k', desc: 'Previous thread' },
  { key: 'g i', desc: 'Go to Inbox' },
  { key: 'g s', desc: 'Go to Sent' },
  { key: 'g d', desc: 'Go to Drafts' },
  { key: 'g a', desc: 'Go to Archive' },
  { key: '/', desc: 'Focus search' },
  { section: 'Thread actions' },
  { key: 'e', desc: 'Archive' },
  { key: '#', desc: 'Trash' },
  { key: 's', desc: 'Star / unstar' },
  { key: 'u', desc: 'Mark unread' },
  { key: 'b', desc: 'Snooze' },
  { section: 'Compose & reply' },
  { key: 'c', desc: 'Compose new' },
  { key: 'r', desc: 'Reply' },
  { key: 'a', desc: 'Reply all' },
  { key: 'f', desc: 'Forward' },
  { section: 'Other' },
  { key: '?', desc: 'Show / hide shortcuts' },
  { key: 'Esc', desc: 'Close modal' },
]

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <span className="text-sm font-semibold">Keyboard shortcuts</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        <div className="px-4 py-3">
          {SHORTCUTS.map((row, i) =>
            'section' in row ? (
              <div key={i} className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-2 first:mt-0">
                {row.section}
              </div>
            ) : (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-600">{row.desc}</span>
                <kbd className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-mono">
                  {row.key}
                </kbd>
              </div>
            )
          )}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
          Shortcuts don't fire when typing in inputs
        </div>
      </div>
    </div>
  )
}
