import type { MailThread, MailMessage, MailboxInfo, CalendarEvent } from '@foundry/shared'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/mail/${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// Raw API shapes — storage layer already maps to camelCase, dates come as ISO strings
interface RawThread {
  id: string; subject: string; participants: { name?: string; email: string }[]
  messageCount: number; unreadCount: number; lastMessageAt: string | null
  snippet: string; isStarred: boolean
}

interface RawMessage {
  id: string; fromEmail: string; fromName: string | null
  toAddrs: { name?: string; email: string }[]; ccAddrs: { name?: string; email: string }[]
  subject: string; bodyHtml: string | null; bodyText: string | null
  date: string; isRead: boolean; isStarred: boolean
}

interface RawMailbox {
  id: string; path: string; name: string; totalCount: number; unreadCount: number
}

interface RawEvent {
  id: string; title: string; description: string | null; location: string | null
  start_at: string; end_at: string; all_day: boolean
  attendees: { name?: string; email: string }[]
}

function toThread(r: RawThread, threadId?: string): MailThread {
  return {
    id: r.id ?? threadId ?? '',
    subject: r.subject,
    participants: r.participants ?? [],
    lastMessageAt: r.lastMessageAt ? new Date(r.lastMessageAt) : new Date(0),
    messageCount: r.messageCount,
    unreadCount: r.unreadCount,
    snippet: r.snippet ?? '',
    isArchived: false,
    isSpam: false,
  }
}

function toMessage(r: RawMessage, threadId: string): MailMessage {
  return {
    id: r.id,
    threadId,
    from: { name: r.fromName ?? undefined, email: r.fromEmail },
    to: r.toAddrs ?? [],
    cc: r.ccAddrs ?? [],
    subject: r.subject,
    bodyHtml: r.bodyHtml,
    bodyText: r.bodyText,
    receivedAt: new Date(r.date),
    isRead: r.isRead,
    isStarred: r.isStarred,
    protocol: 'smtp',
  }
}

function toMailbox(r: RawMailbox): MailboxInfo {
  return {
    id: r.id,
    path: r.path,
    displayName: r.name,
    totalCount: r.totalCount,
    unreadCount: r.unreadCount,
  }
}

function toEvent(r: RawEvent): CalendarEvent {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    location: r.location ?? undefined,
    startAt: new Date(r.start_at),
    endAt: new Date(r.end_at),
    allDay: r.all_day,
    attendees: r.attendees ?? [],
  }
}

export async function listMailboxes(): Promise<MailboxInfo[]> {
  const rows = await req<RawMailbox[]>('mailboxes')
  return rows.map(toMailbox)
}

export async function listThreads(mailbox = 'inbox', page = 1): Promise<MailThread[]> {
  const q = new URLSearchParams({ mailbox, page: String(page) })
  const data = await req<{ threads: RawThread[]; total: number }>(`threads?${q}`)
  return (data.threads ?? []).map((t) => toThread(t))
}

export async function getThread(id: string): Promise<{ thread: MailThread; messages: MailMessage[] }> {
  const data = await req<RawThread & { messages: RawMessage[] }>(`threads/${id}`)
  return {
    thread: toThread(data, id),
    messages: (data.messages ?? []).map((m) => toMessage(m, id)),
  }
}

export async function patchThread(id: string, body: Record<string, unknown>): Promise<void> {
  await req(`threads/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export async function searchThreads(q: string): Promise<MailThread[]> {
  const rows = await req<RawThread[]>(`search?${new URLSearchParams({ q })}`)
  return rows.map((t) => toThread(t))
}

export async function sendMail(payload: {
  from: string
  to: string
  subject: string
  bodyText: string
  bodyHtml?: string
  inReplyTo?: string
}): Promise<void> {
  await req('send', { method: 'POST', body: JSON.stringify(payload) })
}

export async function listCalendarEvents(start?: string, end?: string): Promise<CalendarEvent[]> {
  const q = new URLSearchParams()
  if (start) q.set('start', start)
  if (end) q.set('end', end)
  const rows = await req<RawEvent[]>(`calendar/events?${q}`)
  return rows.map(toEvent)
}

export interface Contact {
  id: string
  name: string | null
  email: string
  phone: string | null
  org: string | null
}

export async function listContacts(q?: string): Promise<Contact[]> {
  const params = q ? `?q=${encodeURIComponent(q)}` : ''
  return req<Contact[]>(`contacts${params}`)
}
