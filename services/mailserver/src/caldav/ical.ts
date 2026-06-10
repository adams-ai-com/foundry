import type { CalEvent } from '../storage/calendars.js'

// ── Serializer ───────────────────────────────────────────────────────────────

function fmtDt(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace('.000', '')
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

function fold(line: string): string {
  // RFC 5545 line folding: max 75 octets, continuation with CRLF + space
  const chunks: string[] = []
  let remaining = line
  while (remaining.length > 75) {
    chunks.push(remaining.slice(0, 75))
    remaining = ' ' + remaining.slice(75)
  }
  chunks.push(remaining)
  return chunks.join('\r\n')
}

function escape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function serializeEvent(e: CalEvent): string {
  const uid = e.icalUid ?? `${e.id}@foundry`
  const stamp = fmtDt(e.updatedAt)
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Foundry//Foundry Calendar//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    fold(`UID:${uid}`),
    `DTSTAMP:${stamp}`,
  ]

  if (e.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${fmtDate(e.startAt)}`)
    lines.push(`DTEND;VALUE=DATE:${fmtDate(e.endAt)}`)
  } else {
    lines.push(`DTSTART:${fmtDt(e.startAt)}`)
    lines.push(`DTEND:${fmtDt(e.endAt)}`)
  }

  lines.push(fold(`SUMMARY:${escape(e.title)}`))
  if (e.description) lines.push(fold(`DESCRIPTION:${escape(e.description)}`))
  if (e.location) lines.push(fold(`LOCATION:${escape(e.location)}`))
  if (e.organizerEmail) lines.push(fold(`ORGANIZER;CN=Organizer:mailto:${e.organizerEmail}`))
  if (e.rrule) lines.push(fold(`RRULE:${e.rrule}`))
  lines.push(`SEQUENCE:${e.sequence}`)

  for (const att of e.attendees as { name?: string; email: string; status?: string }[]) {
    const partstat = att.status?.toUpperCase() ?? 'NEEDS-ACTION'
    const cn = att.name ? `;CN=${att.name}` : ''
    lines.push(fold(`ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=${partstat}${cn};RSVP=TRUE:mailto:${att.email}`))
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

// ── Parser ────────────────────────────────────────────────────────────────────

export interface ParsedEvent {
  uid: string
  title: string
  description?: string
  location?: string
  startAt: Date
  endAt: Date
  allDay: boolean
  organizerEmail?: string
  sequence: number
  rrule?: string
  attendees: { name?: string; email: string; status?: string }[]
}

function unfold(text: string): string {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
}

function unescape(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

function parseDate(value: string, params: string): Date {
  // DATE-only: 20250525
  if (params.includes('VALUE=DATE') || value.length === 8) {
    const y = parseInt(value.slice(0, 4))
    const m = parseInt(value.slice(4, 6)) - 1
    const d = parseInt(value.slice(6, 8))
    return new Date(Date.UTC(y, m, d))
  }
  // DATETIME: 20250525T140000Z or 20250525T140000
  const s = value.replace('T', '').replace('Z', '')
  const y = parseInt(s.slice(0, 4))
  const mo = parseInt(s.slice(4, 6)) - 1
  const d = parseInt(s.slice(6, 8))
  const h = parseInt(s.slice(8, 10) || '0')
  const mi = parseInt(s.slice(10, 12) || '0')
  const se = parseInt(s.slice(12, 14) || '0')
  return value.endsWith('Z')
    ? new Date(Date.UTC(y, mo, d, h, mi, se))
    : new Date(y, mo, d, h, mi, se)
}

export function parseIcal(text: string): ParsedEvent | null {
  const unfolded = unfold(text)
  const lines = unfolded.split(/\r?\n/).filter(Boolean)

  let inEvent = false
  const props: Record<string, { value: string; params: string }[]> = {}

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; continue }
    if (line === 'END:VEVENT') { inEvent = false; continue }
    if (!inEvent) continue

    const colon = line.indexOf(':')
    if (colon < 0) continue
    const nameAndParams = line.slice(0, colon)
    const value = line.slice(colon + 1)
    const semi = nameAndParams.indexOf(';')
    const name = semi >= 0 ? nameAndParams.slice(0, semi).toUpperCase() : nameAndParams.toUpperCase()
    const params = semi >= 0 ? nameAndParams.slice(semi + 1) : ''

    if (!props[name]) props[name] = []
    props[name].push({ value, params })
  }

  const uid = props['UID']?.[0]?.value
  const summary = props['SUMMARY']?.[0]?.value
  if (!uid || !summary) return null

  const dtstart = props['DTSTART']?.[0]
  const dtend = props['DTEND']?.[0]
  if (!dtstart || !dtend) return null

  const allDay = dtstart.params.includes('VALUE=DATE') || dtstart.value.length === 8

  const organizer = props['ORGANIZER']?.[0]?.value ?? ''
  const organizerEmail = organizer.replace(/^mailto:/i, '') || undefined

  const attendees: ParsedEvent['attendees'] = (props['ATTENDEE'] ?? []).map((a) => {
    const email = a.value.replace(/^mailto:/i, '')
    const cnMatch = a.params.match(/CN=([^;]+)/)
    const statusMatch = a.params.match(/PARTSTAT=([^;]+)/)
    return {
      email,
      name: cnMatch?.[1],
      status: statusMatch?.[1]?.toLowerCase(),
    }
  })

  return {
    uid,
    title: unescape(summary),
    description: props['DESCRIPTION']?.[0]?.value ? unescape(props['DESCRIPTION'][0].value) : undefined,
    location: props['LOCATION']?.[0]?.value ? unescape(props['LOCATION'][0].value) : undefined,
    startAt: parseDate(dtstart.value, dtstart.params),
    endAt: parseDate(dtend.value, dtend.params),
    allDay,
    organizerEmail,
    sequence: parseInt(props['SEQUENCE']?.[0]?.value ?? '0', 10),
    rrule: props['RRULE']?.[0]?.value,
    attendees,
  }
}
