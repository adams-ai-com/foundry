'use client'

import { useState } from 'react'
import { InboxView } from './InboxView'
import { MessageReader } from './MessageReader'
import { CalendarView } from './CalendarView'
import { ComposeModal } from './ComposeModal'
import type { MailThread } from '@foundry/shared'

type View = 'inbox' | 'calendar' | 'contacts'

export function MailShell() {
  const [view, setView] = useState<View>('inbox')
  const [selectedThread, setSelectedThread] = useState<MailThread | null>(null)
  const [composing, setComposing] = useState(false)

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="font-semibold text-sm">Foundry Mail</span>
          </div>
        </div>

        <div className="p-2">
          <button
            onClick={() => setComposing(true)}
            className="w-full bg-blue-600 text-white text-sm px-3 py-2 rounded hover:bg-blue-700 transition-colors font-medium"
          >
            Compose
          </button>
        </div>

        <nav className="p-2 flex flex-col gap-0.5">
          {([
            { id: 'inbox', label: 'Inbox', icon: '📥' },
            { id: 'calendar', label: 'Calendar', icon: '📅' },
            { id: 'contacts', label: 'Contacts', icon: '👤' },
          ] as { id: View; label: string; icon: string }[]).map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded w-full text-left transition-colors ${
                view === id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden flex">
        {view === 'inbox' && (
          <>
            <InboxView selectedThread={selectedThread} onSelectThread={setSelectedThread} />
            <MessageReader thread={selectedThread} />
          </>
        )}
        {view === 'calendar' && <CalendarView />}
        {view === 'contacts' && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Contacts coming soon
          </div>
        )}
      </main>

      {composing && <ComposeModal onClose={() => setComposing(false)} />}
    </div>
  )
}
