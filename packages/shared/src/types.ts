export * from './utils'

export interface MailThread {
  id: string
  subject: string
  participants: MailAddress[]
  lastMessageAt: Date
  messageCount: number
  unreadCount: number
  snippet: string
  isArchived: boolean
  isSpam: boolean
  isStarred: boolean
  snoozedUntil?: Date | null
  accountId?: string
  accountDomain?: string | null
}

export interface MailMessage {
  id: string
  threadId: string
  messageId?: string
  from: MailAddress
  to: MailAddress[]
  cc: MailAddress[]
  subject: string
  bodyHtml: string | null
  bodyText: string | null
  receivedAt: Date
  isRead: boolean
  isStarred: boolean
  protocol: 'smtp' | 'internal'
  attachments: MailAttachment[]
}

export interface MailAttachment {
  id: string
  filename: string
  contentType: string
  size: number
}

export interface MailAddress {
  name?: string
  email: string
}

export interface MailboxInfo {
  id: string
  path: string
  displayName: string
  totalCount: number
  unreadCount: number
}

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  location?: string
  startAt: Date
  endAt: Date
  allDay: boolean
  attendees: MailAddress[]
}
