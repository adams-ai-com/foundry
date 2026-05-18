// Docs

export interface Document {
  id: string
  title: string
  content: object  // ProseMirror JSON
  createdAt: Date
  updatedAt: Date
}

// Sheets

export interface Workbook {
  id: string
  title: string
  sheets: Sheet[]
  createdAt: Date
  updatedAt: Date
}

export interface Sheet {
  name: string
  data: CellData[][]
}

export interface CellData {
  value: string | number | boolean | null
  formula?: string
  format?: CellFormat
}

export interface CellFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  numberFormat?: string
  align?: 'left' | 'center' | 'right'
  backgroundColor?: string
  textColor?: string
}

export interface CellAddress {
  sheet: string
  row: number
  col: number
}

// Mail

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
}

export interface MailMessage {
  id: string
  threadId: string
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

export interface Attachment {
  id: string
  name: string
  size: number
  contentType: string
}

export interface CalendarEvent {
  id: string
  title: string
  startAt: Date
  endAt: Date
  allDay: boolean
  description?: string
  location?: string
  attendees: MailAddress[]
}
