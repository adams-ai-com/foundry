import type { MailThread, MailMessage, MailboxInfo, CalendarEvent } from '@foundry/shared'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/mail/api/mail/${path}`, {
    headers: init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
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
    isStarred: (r as any).isStarred ?? false,
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
    attachments: (r as any).attachments ?? [],
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

export async function listThreads(
  mailbox = 'inbox',
  page = 1,
  sort: 'newest' | 'oldest' | 'unread' = 'newest',
): Promise<{ threads: MailThread[]; total: number }> {
  const q = new URLSearchParams({ mailbox, page: String(page), sort })
  const data = await req<{ threads: RawThread[]; total: number }>(`threads?${q}`)
  return {
    threads: (data.threads ?? []).map((t) => toThread(t)),
    total: data.total ?? 0,
  }
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

export async function archiveThread(id: string): Promise<void> {
  await patchThread(id, { action: 'archive' })
}

export async function trashThread(id: string): Promise<void> {
  await patchThread(id, { action: 'trash' })
}

export async function starThread(id: string, starred: boolean): Promise<void> {
  await patchThread(id, { action: starred ? 'star' : 'unstar' })
}

export async function markThreadUnread(id: string): Promise<void> {
  await patchThread(id, { action: 'unread' })
}

export async function permanentlyDeleteThread(id: string): Promise<void> {
  await req(`threads/${id}`, { method: 'DELETE' })
}

export async function searchThreads(q: string): Promise<MailThread[]> {
  const rows = await req<RawThread[]>(`search?${new URLSearchParams({ q })}`)
  return rows.map((t) => toThread(t))
}

export async function sendMail(payload: {
  from: string
  to: { name?: string; email: string }[]
  cc?: { name?: string; email: string }[]
  bcc?: { name?: string; email: string }[]
  subject: string
  bodyText: string
  bodyHtml?: string
  inReplyTo?: string
  threadId?: string
  attachmentIds?: string[]
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
  lastContactedAt?: string | null
}

export async function listContacts(q?: string): Promise<Contact[]> {
  const params = q ? `?q=${encodeURIComponent(q)}` : ''
  return req<Contact[]>(`contacts${params}`)
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface Task {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assignedTo: string | null
  dueAt: string | null
  sourceThreadId: string | null
  sourceDecisionId: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export async function listTasks(status?: string): Promise<{ tasks: Task[]; total: number }> {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  return req<{ tasks: Task[]; total: number }>(`tasks${q}`)
}

export async function createTask(input: {
  title: string
  description?: string
  priority?: Task['priority']
  assignedTo?: string
  dueAt?: string
  sourceThreadId?: string
}): Promise<Task> {
  return req<Task>('tasks', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateTask(id: string, patch: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignedTo' | 'dueAt'>>): Promise<Task> {
  return req<Task>(`tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function deleteTask(id: string): Promise<void> {
  await req(`tasks/${id}`, { method: 'DELETE' })
}

// ─── Decisions ────────────────────────────────────────────────────────────────

export interface Decision {
  id: string
  subject: string
  outcome: string
  decidedBy: string | null
  decidedAt: string
  sourceThreadId: string | null
  sourceMeetingId: string | null
  createdAt: string
}

export async function listDecisions(): Promise<{ decisions: Decision[]; total: number }> {
  return req<{ decisions: Decision[]; total: number }>('decisions')
}

export async function createDecision(input: {
  subject: string
  outcome: string
  decidedBy?: string
  decidedAt?: string
  sourceThreadId?: string
}): Promise<Decision> {
  return req<Decision>('decisions', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateDecision(id: string, patch: Partial<Pick<Decision, 'subject' | 'outcome' | 'decidedBy' | 'decidedAt'>>): Promise<Decision> {
  return req<Decision>(`decisions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function deleteDecision(id: string): Promise<void> {
  await req(`decisions/${id}`, { method: 'DELETE' })
}

// ─── Files ────────────────────────────────────────────────────────────────────

export interface FileItem {
  id: string
  filename: string
  contentType: string
  size: number
  messageId: string | null
  createdAt: string
}

export async function listFiles(opts: { page?: number; search?: string } = {}): Promise<{ files: FileItem[]; total: number }> {
  const q = new URLSearchParams()
  if (opts.page) q.set('page', String(opts.page))
  if (opts.search) q.set('search', opts.search)
  return req<{ files: FileItem[]; total: number }>(`files?${q}`)
}

export async function uploadFile(file: File): Promise<FileItem> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/mail/api/mail/files', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export function downloadFileUrl(id: string): string {
  return `/mail/api/mail/files/${id}/download`
}

export async function deleteFile(id: string): Promise<void> {
  await req(`files/${id}`, { method: 'DELETE' })
}

// ─── Channels ─────────────────────────────────────────────────────────────────

export interface Channel {
  id: string
  name: string
  description: string | null
  isPrivate: boolean
  createdAt: string
}

export interface ChannelMessage {
  id: string
  channelId: string
  senderName: string
  senderEmail: string
  body: string
  editedAt: string | null
  createdAt: string
}

interface RawChannelMessage {
  id: string
  channel_id: string
  sender_name: string
  sender_email: string
  body: string
  edited_at: string | null
  created_at: string
}

function toChannelMessage(r: RawChannelMessage): ChannelMessage {
  return {
    id: r.id,
    channelId: r.channel_id,
    senderName: r.sender_name,
    senderEmail: r.sender_email,
    body: r.body,
    editedAt: r.edited_at,
    createdAt: r.created_at,
  }
}

export async function listChannels(): Promise<Channel[]> {
  return req<Channel[]>('channels')
}

export async function createChannel(input: { name: string; description?: string }): Promise<Channel> {
  return req<Channel>('channels', { method: 'POST', body: JSON.stringify(input) })
}

export async function deleteChannel(id: string): Promise<void> {
  await req(`channels/${id}`, { method: 'DELETE' })
}

export async function listChannelMessages(
  channelId: string,
  opts: { before?: string; after?: string; limit?: number } = {},
): Promise<ChannelMessage[]> {
  const q = new URLSearchParams()
  if (opts.before) q.set('before', opts.before)
  if (opts.after) q.set('after', opts.after)
  if (opts.limit) q.set('limit', String(opts.limit))
  const raw = await req<RawChannelMessage[]>(`channels/${channelId}/messages?${q}`)
  return raw.map(toChannelMessage)
}

export async function postChannelMessage(
  channelId: string,
  body: string,
): Promise<ChannelMessage> {
  const raw = await req<RawChannelMessage>(`channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      body,
      senderEmail: process.env.NEXT_PUBLIC_MAIL_FROM ?? 'user@foundry.local',
      senderName: process.env.NEXT_PUBLIC_DISPLAY_NAME ?? '',
    }),
  })
  return toChannelMessage(raw)
}

export async function deleteChannelMessage(channelId: string, messageId: string): Promise<void> {
  await req(`channels/${channelId}/messages/${messageId}`, { method: 'DELETE' })
}
