'use client'

import { useEffect, useState, useRef } from 'react'
import { InboxView, type InboxViewHandle } from './InboxView'
import { MessageReader } from './MessageReader'
import { CalendarView } from './CalendarView'
import { TasksView } from './TasksView'
import { DecisionsView } from './DecisionsView'
import { FilesView } from './FilesView'
import { ChannelsView } from './ChannelsView'
import { ComposeModal, type ComposeRequest } from './ComposeModal'
import { ThemeSwitcher } from '@foundry/ui'
import type { MailThread, MailboxInfo } from '@foundry/shared'
import { listMailboxes, archiveThread, trashThread, starThread, markThreadUnread } from '../lib/api'

type View  = 'mail' | 'calendar' | 'contacts' | 'tasks' | 'decisions' | 'files' | 'channels'
type Theme = 'light' | 'dark' | 'warm'

const SYSTEM_MAILBOXES = ['inbox', 'starred', 'sent', 'drafts', 'archive', 'trash', 'spam']
const SHORTCUTS = [
  { key: 'j', desc: 'Next thread' },   { key: 'k', desc: 'Previous thread' },
  { key: 'c', desc: 'Compose' },        { key: 'r', desc: 'Reply' },
  { key: 'a', desc: 'Reply all' },      { key: 'e', desc: 'Archive' },
  { key: '#', desc: 'Trash' },          { key: 's', desc: 'Star / Unstar' },
  { key: 'u', desc: 'Mark unread' },    { key: '?', desc: 'Show shortcuts' },
]

function HamburgerIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
}
function PencilIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
function InboxIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
}
function StarIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
}
function SendIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
}
function DraftIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
}
function ArchiveIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
}
function TrashIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
}
function SpamIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}
function CalendarIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function ContactsIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
}
function TasksIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
}
function DecisionsIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
}
function ChannelsIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
}
function FilesIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
}
function FolderCustomIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
}
function XIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}

const MAILBOX_ICON: Record<string, (p: { className?: string }) => React.JSX.Element> = {
  inbox: InboxIcon, starred: StarIcon, sent: SendIcon,
  drafts: DraftIcon, archive: ArchiveIcon, trash: TrashIcon, spam: SpamIcon,
}
const VIEWS: { id: View; label: string; Icon: (p: { className?: string }) => React.JSX.Element }[] = [
  { id: 'calendar',  label: 'Calendar',  Icon: CalendarIcon  },
  { id: 'contacts',  label: 'Contacts',  Icon: ContactsIcon  },
  { id: 'tasks',     label: 'Tasks',     Icon: TasksIcon     },
  { id: 'decisions', label: 'Decisions', Icon: DecisionsIcon },
  { id: 'channels',  label: 'Channels',  Icon: ChannelsIcon  },
  { id: 'files',     label: 'Files',     Icon: FilesIcon     },
]

export function MailShell({ defaultTheme = 'light' }: { defaultTheme?: Theme }) {
  const [view, setView] = useState<View>('mail')
  const [mailbox, setMailbox] = useState('inbox')
  const [selectedThread, setSelectedThread] = useState<MailThread | null>(null)
  const [composing, setComposing] = useState(false)
  const [composeRequest, setComposeRequest] = useState<ComposeRequest | undefined>(undefined)
  const [mailboxes, setMailboxes] = useState<MailboxInfo[]>([])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const inboxRef = useRef<InboxViewHandle>(null)

  useEffect(() => { listMailboxes().then(setMailboxes).catch(() => setMailboxes([])) }, [])

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  const handleSelectMailbox = (path: string) => {
    setMailbox(path); setSelectedThread(null); setView('mail')
    closeSidebarOnMobile()
  }
  const handleCompose = (req?: ComposeRequest) => { setComposeRequest(req); setComposing(true) }

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (['input','textarea','select'].includes(tag)) return
      if ((e.target as HTMLElement).isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (composing) return
      const threads = inboxRef.current?.getThreads() ?? []
      const idx = threads.findIndex((t) => t.id === selectedThread?.id)
      switch (e.key) {
        case 'j': { if (view !== 'mail') break; const next = threads[idx+1] ?? threads[0]; if (next) setSelectedThread(next); break }
        case 'k': { if (view !== 'mail') break; const prev = threads[idx-1] ?? threads[threads.length-1]; if (prev) setSelectedThread(prev); break }
        case 'c': handleCompose(); break
        case 'r': if (selectedThread && view === 'mail') handleCompose({ replyTo: selectedThread }); break
        case 'a': if (selectedThread && view === 'mail') handleCompose({ replyTo: selectedThread, replyAll: true }); break
        case 'e': { if (!selectedThread || view !== 'mail') break; const id = selectedThread.id; await archiveThread(id); inboxRef.current?.removeThread(id); setSelectedThread(null); break }
        case '#': { if (!selectedThread || view !== 'mail') break; const id = selectedThread.id; await trashThread(id); inboxRef.current?.removeThread(id); setSelectedThread(null); break }
        case 's': { if (!selectedThread || view !== 'mail') break; const starred = !selectedThread.isStarred; await starThread(selectedThread.id, starred); setSelectedThread((t) => t ? { ...t, isStarred: starred } : t); break }
        case 'u': { if (!selectedThread || view !== 'mail') break; await markThreadUnread(selectedThread.id); setSelectedThread(null); break }
        case '?': e.preventDefault(); setShowShortcuts((v) => !v); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view, selectedThread, composing]) // eslint-disable-line react-hooks/exhaustive-deps

  const mailboxLabel = (p: string) => p.charAt(0).toUpperCase() + p.slice(1)
  const sidebarMailboxes = SYSTEM_MAILBOXES.map((path) => {
    const found = mailboxes.find((m) => m.path === path)
    return { path, unreadCount: found?.unreadCount ?? 0 }
  })
  const customMailboxes = mailboxes.filter((m) => !SYSTEM_MAILBOXES.includes(m.path))

  const currentViewLabel = view === 'mail' ? mailboxLabel(mailbox) : (VIEWS.find((v) => v.id === view)?.label ?? view)

  return (
    <div className="h-screen flex bg-bg-base overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — drawer on mobile, inline on md+ */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-52 border-r border-border bg-bg-surface flex flex-col flex-shrink-0
        transition-transform duration-200
        md:relative md:translate-x-0 md:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-accent-fg" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <span className="font-semibold text-sm text-fg-primary tracking-tight">Mail</span>
          </div>
          {/* Close button for mobile drawer */}
          <button
            className="md:hidden w-6 h-6 flex items-center justify-center rounded text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-3 py-3">
          <button data-testid="compose-button" onClick={() => { handleCompose(); closeSidebarOnMobile() }}
            className="w-full flex items-center justify-center gap-2 bg-accent text-accent-fg text-sm px-3 py-2 rounded-lg hover:bg-accent-hover transition-colors font-medium">
            <PencilIcon className="w-3.5 h-3.5" />
            Compose
          </button>
        </div>

        <nav className="px-2 flex flex-col gap-px overflow-y-auto flex-1">
          {sidebarMailboxes.map(({ path, unreadCount }) => {
            const Icon = MAILBOX_ICON[path] ?? InboxIcon
            const isActive = view === 'mail' && mailbox === path
            return (
              <button key={path} onClick={() => handleSelectMailbox(path)}
                className={`flex items-center gap-2.5 text-sm px-2.5 py-1.5 rounded-lg w-full text-left transition-colors ${isActive ? 'bg-accent/10 text-accent font-medium' : 'text-fg-secondary hover:bg-bg-hover hover:text-fg-primary'}`}>
                <Icon className="w-4 h-4 flex-shrink-0 opacity-70" />
                <span className="flex-1">{mailboxLabel(path)}</span>
                {unreadCount > 0 && <span className="text-xs bg-accent text-accent-fg rounded-full px-1.5 py-0.5 font-medium leading-none">{unreadCount}</span>}
              </button>
            )
          })}

          {customMailboxes.length > 0 && (
            <>
              <div className="text-[10.5px] font-semibold text-fg-tertiary uppercase tracking-[0.15em] px-2.5 pt-4 pb-1.5">Folders</div>
              {customMailboxes.map((m) => {
                const isActive = view === 'mail' && mailbox === m.path
                return (
                  <button key={m.path} onClick={() => handleSelectMailbox(m.path)}
                    className={`flex items-center gap-2.5 text-sm px-2.5 py-1.5 rounded-lg w-full text-left transition-colors ${isActive ? 'bg-accent/10 text-accent font-medium' : 'text-fg-secondary hover:bg-bg-hover hover:text-fg-primary'}`}>
                    <FolderCustomIcon className="w-4 h-4 flex-shrink-0 opacity-70" />
                    <span className="flex-1">{m.displayName}</span>
                    {m.unreadCount > 0 && <span className="text-xs bg-accent text-accent-fg rounded-full px-1.5 py-0.5 font-medium leading-none">{m.unreadCount}</span>}
                  </button>
                )
              })}
            </>
          )}

          <div className="border-t border-border mt-2 pt-2 flex flex-col gap-px">
            {VIEWS.map(({ id, label, Icon }) => {
              const isActive = view === id
              return (
                <button key={id} data-testid={`nav-${id}`} onClick={() => { setView(id); closeSidebarOnMobile() }}
                  className={`flex items-center gap-2.5 text-sm px-2.5 py-1.5 rounded-lg w-full text-left transition-colors ${isActive ? 'bg-accent/10 text-accent font-medium' : 'text-fg-secondary hover:bg-bg-hover hover:text-fg-primary'}`}>
                  <Icon className="w-4 h-4 flex-shrink-0 opacity-70" />
                  {label}
                </button>
              )
            })}
          </div>

          <div className="mt-auto pt-2 border-t border-border pb-1">
            <div className="px-2.5 py-1.5"><ThemeSwitcher defaultTheme={defaultTheme} /></div>
            <button onClick={() => setShowShortcuts(true)}
              className="flex items-center gap-2 text-xs text-fg-tertiary hover:text-fg-secondary px-2.5 py-1.5 w-full text-left transition-colors rounded-lg hover:bg-bg-hover">
              <kbd className="font-mono bg-bg-hover border border-border rounded px-1 text-fg-secondary text-[10px]">?</kbd>
              Keyboard shortcuts
            </button>
          </div>
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-2.5 border-b border-border bg-bg-surface flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-fg-secondary hover:text-fg-primary transition-colors"
            aria-label="Open menu"
          >
            <HamburgerIcon className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm text-fg-primary capitalize">{currentViewLabel}</span>
        </div>

        <main className="flex-1 overflow-hidden flex">
          {view === 'mail' && <><InboxView ref={inboxRef} mailbox={mailbox} selectedThread={selectedThread} onSelectThread={setSelectedThread} /><MessageReader thread={selectedThread} onCompose={handleCompose} /></>}
          {view === 'calendar'  && <CalendarView />}
          {view === 'contacts'  && <div className="flex-1 flex items-center justify-center text-fg-tertiary text-sm">Contacts coming soon</div>}
          {view === 'tasks'     && <div className="flex-1 overflow-hidden bg-bg-surface text-fg-primary"><TasksView /></div>}
          {view === 'decisions' && <div className="flex-1 overflow-hidden bg-bg-surface text-fg-primary"><DecisionsView /></div>}
          {view === 'channels'  && <div className="flex-1 overflow-hidden bg-bg-surface text-fg-primary"><ChannelsView /></div>}
          {view === 'files'     && <div className="flex-1 overflow-hidden bg-bg-surface text-fg-primary relative"><FilesView /></div>}
        </main>
      </div>

      {composing && <ComposeModal onClose={() => { setComposing(false); setComposeRequest(undefined) }} request={composeRequest} />}

      {showShortcuts && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowShortcuts(false)}>
          <div className="bg-bg-raised border border-border rounded-xl shadow-card p-6 w-80" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-sm text-fg-primary">Keyboard shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)} className="w-6 h-6 flex items-center justify-center rounded text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover transition-colors">
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <table className="w-full text-sm"><tbody>
              {SHORTCUTS.map(({ key, desc }) => (
                <tr key={key} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-4"><kbd className="font-mono bg-bg-surface border border-border rounded px-1.5 py-0.5 text-xs text-fg-primary">{key}</kbd></td>
                  <td className="py-1.5 text-fg-secondary">{desc}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      )}
    </div>
  )
}
