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

export interface MailAccount {
  id: string
  email: string
  displayName: string
  serverUrl: string  // JMAP session URL
}

export interface MailThread {
  id: string
  subject: string
  participants: string[]
  lastMessageAt: Date
  messageCount: number
  unread: boolean
  snippet: string
}

export interface MailMessage {
  id: string
  threadId: string
  from: MailAddress
  to: MailAddress[]
  cc: MailAddress[]
  subject: string
  bodyHtml: string
  bodyText: string
  date: Date
  attachments: Attachment[]
}

export interface MailAddress {
  name?: string
  email: string
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
  start: Date
  end: Date
  allDay: boolean
  description?: string
  location?: string
  attendees: MailAddress[]
}
