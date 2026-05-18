import type { MailThread, MailMessage, MailboxInfo, CalendarEvent, MailAddress } from '@foundry/shared'

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

// Raw API shapes (snake_case from postgres)
interface RawThread {
  id: string; subject: string; participants: MailAddress[]
  last_message_at: string; message_count: number; unread_count: number
  snippet: string | null; is_archived: boolean; is_spam: boolean
}

interface RawMessage {
  id: string; thread_id: string; from_email: string; from_name: string | null
  to_addrs: MailAddress[]; cc_addrs: MailAddress[]; subject: string
  body_html: string | null; body_text: string | null
  received_at: string; is_read: boolean; is_starred: boolean
  protocol: 'smtp' | 'internal'
}

interface RawMailbox {
  id: string; path: string; display_name: string
  total_count: number; unread_count: number
}

interface RawEvent {
  id: string; title: string; description: string | null; location: string | null
  start_at: string; end_at: string; all_day: boolean
  attendees: MailAddress[]
}

function toThread(r: RawThread): MailThread {
  return {
    id: r.id,
    subject: r.subject,
    participants: r.participants ?? [],
    lastMessageAt: new Date(r.last_message_at),
    messageCount: r.message_count,
    unreadCount: r.unread_count,
    snippet: r.snippet ?? '',
    isArchived: r.is_archived ?? false,
    isSpam: r.is_spam ?? false,
  }
}

function toMessage(r: RawMessage): MailMessage {
  return {
    id: r.id,
    threadId: r.thread_id,
    from: { name: r.from_name ?? undefined, email: r.from_email },
    to: r.to_addrs ?? [],
    cc: r.cc_addrs ?? [],
    subject: r.subject,
    bodyHtml: r.body_html,
    bodyText: r.body_text,
    receivedAt: new Date(r.received_at),
    isRead: r.is_read,
    isStarred: r.is_starred,
    protocol: r.protocol,
  }
}

function toMailbox(r: RawMailbox): MailboxInfo {
  return {
    id: r.id,
    path: r.path,
    displayName: r.display_name,
    totalCount: r.total_count,
    unreadCount: r.unread_count,
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

export async function listThreads(mailbox = 'inbox', cursor?: string): Promise<MailThread[]> {
  const q = new URLSearchParams({ mailbox, limit: '50' })
  if (cursor) q.set('cursor', cursor)
  const rows = await req<RawThread[]>(`threads?${q}`)
  return rows.map(toThread)
}

export async function getThread(id: string): Promise<{ thread: MailThread; messages: MailMessage[] }> {
  const data = await req<{ thread: RawThread; messages: RawMessage[] }>(`threads/${id}`)
  return { thread: toThread(data.thread), messages: data.messages.map(toMessage) }
}

export async function patchThread(id: string, body: Record<string, unknown>): Promise<void> {
  await req(`threads/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export async function searchThreads(q: string): Promise<MailThread[]> {
  const rows = await req<RawThread[]>(`search?${new URLSearchParams({ q })}`)
  return rows.map(toThread)
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
