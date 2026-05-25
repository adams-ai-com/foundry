import { sql as db, newId } from '../db.js'
import { createHash } from 'crypto'

export interface Calendar {
  id: string
  accountId: string
  name: string
  color: string
  description: string | null
  isDefault: boolean
  ctag: string
  createdAt: Date
}

export interface CalEvent {
  id: string
  accountId: string
  calendarId: string | null
  title: string
  description: string | null
  location: string | null
  startAt: Date
  endAt: Date
  allDay: boolean
  attendees: { name?: string; email: string; status?: string }[]
  organizerEmail: string | null
  sourceMessageId: string | null
  icalUid: string | null
  etag: string
  sequence: number
  rrule: string | null
  createdAt: Date
  updatedAt: Date
}

function etag(uid: string, updatedAt: Date): string {
  return createHash('sha1').update(`${uid}:${updatedAt.getTime()}`).digest('hex').slice(0, 16)
}

export async function getOrCreateDefaultCalendar(accountId: string): Promise<Calendar> {
  const [existing] = await db<Calendar[]>`
    SELECT id, account_id, name, color, description, is_default, ctag, created_at
    FROM calendars WHERE account_id = ${accountId} AND is_default = TRUE
  `
  if (existing) return existing

  const id = newId()
  const [cal] = await db<Calendar[]>`
    INSERT INTO calendars (id, account_id, name, color, is_default, ctag)
    VALUES (${id}, ${accountId}, 'Personal', '#10b981', TRUE, ${Date.now().toString()})
    ON CONFLICT DO NOTHING
    RETURNING id, account_id, name, color, description, is_default, ctag, created_at
  `
  return cal ?? (await getOrCreateDefaultCalendar(accountId))
}

export async function listCalendars(accountId: string): Promise<Calendar[]> {
  return db<Calendar[]>`
    SELECT id, account_id, name, color, description, is_default, ctag, created_at
    FROM calendars WHERE account_id = ${accountId} ORDER BY is_default DESC, name ASC
  `
}

export async function getCalendar(accountId: string, calendarId: string): Promise<Calendar | null> {
  const [row] = await db<Calendar[]>`
    SELECT id, account_id, name, color, description, is_default, ctag, created_at
    FROM calendars WHERE id = ${calendarId} AND account_id = ${accountId}
  `
  return row ?? null
}

async function touchCalendarCtag(calendarId: string): Promise<void> {
  await db`UPDATE calendars SET ctag = ${Date.now().toString()} WHERE id = ${calendarId}`
}

export async function listEvents(
  accountId: string,
  opts: { calendarId?: string; start?: Date; end?: Date } = {},
): Promise<CalEvent[]> {
  const { calendarId, start, end } = opts

  const where = calendarId
    ? db`account_id = ${accountId} AND calendar_id = ${calendarId}`
    : db`account_id = ${accountId}`

  const timeFilter =
    start && end
      ? db`AND start_at >= ${start} AND start_at <= ${end}`
      : start
      ? db`AND start_at >= ${start}`
      : end
      ? db`AND start_at <= ${end}`
      : db``

  return db<CalEvent[]>`
    SELECT id, account_id, calendar_id, title, description, location,
           start_at, end_at, all_day, attendees, organizer_email,
           source_message_id, ical_uid, etag, sequence, rrule, created_at, updated_at
    FROM calendar_events
    WHERE ${where} ${timeFilter}
    ORDER BY start_at ASC
  `
}

export async function getEventByUid(accountId: string, uid: string): Promise<CalEvent | null> {
  const [row] = await db<CalEvent[]>`
    SELECT id, account_id, calendar_id, title, description, location,
           start_at, end_at, all_day, attendees, organizer_email,
           source_message_id, ical_uid, etag, sequence, rrule, created_at, updated_at
    FROM calendar_events WHERE account_id = ${accountId} AND ical_uid = ${uid}
  `
  return row ?? null
}

export async function getEvent(accountId: string, id: string): Promise<CalEvent | null> {
  const [row] = await db<CalEvent[]>`
    SELECT id, account_id, calendar_id, title, description, location,
           start_at, end_at, all_day, attendees, organizer_email,
           source_message_id, ical_uid, etag, sequence, rrule, created_at, updated_at
    FROM calendar_events WHERE account_id = ${accountId} AND id = ${id}
  `
  return row ?? null
}

export async function upsertEventByUid(
  accountId: string,
  calendarId: string,
  input: {
    uid: string
    title: string
    description?: string
    location?: string
    startAt: Date
    endAt: Date
    allDay?: boolean
    attendees?: { name?: string; email: string; status?: string }[]
    organizerEmail?: string
    rrule?: string
    sequence?: number
  },
): Promise<CalEvent> {
  const existing = await getEventByUid(accountId, input.uid)
  const now = new Date()
  const tag = etag(input.uid, now)

  if (existing) {
    const [row] = await db<CalEvent[]>`
      UPDATE calendar_events SET
        title           = ${input.title},
        description     = ${input.description ?? null},
        location        = ${input.location ?? null},
        start_at        = ${input.startAt},
        end_at          = ${input.endAt},
        all_day         = ${input.allDay ?? false},
        attendees       = ${JSON.stringify(input.attendees ?? [])}::jsonb,
        organizer_email = ${input.organizerEmail ?? null},
        rrule           = ${input.rrule ?? null},
        sequence        = ${input.sequence ?? existing.sequence + 1},
        etag            = ${tag},
        updated_at      = ${now}
      WHERE id = ${existing.id} AND account_id = ${accountId}
      RETURNING *
    `
    await touchCalendarCtag(calendarId)
    return row
  }

  const id = newId()
  const [row] = await db<CalEvent[]>`
    INSERT INTO calendar_events (
      id, account_id, calendar_id, title, description, location,
      start_at, end_at, all_day, attendees, organizer_email,
      ical_uid, etag, sequence, rrule
    ) VALUES (
      ${id}, ${accountId}, ${calendarId}, ${input.title}, ${input.description ?? null},
      ${input.location ?? null}, ${input.startAt}, ${input.endAt}, ${input.allDay ?? false},
      ${JSON.stringify(input.attendees ?? [])}::jsonb, ${input.organizerEmail ?? null},
      ${input.uid}, ${tag}, ${input.sequence ?? 0}, ${input.rrule ?? null}
    )
    RETURNING *
  `
  await touchCalendarCtag(calendarId)
  return row
}

export async function createEvent(
  accountId: string,
  calendarId: string,
  input: {
    title: string
    description?: string
    location?: string
    startAt: Date
    endAt: Date
    allDay?: boolean
    attendees?: { name?: string; email: string; status?: string }[]
    organizerEmail?: string
    rrule?: string
  },
): Promise<CalEvent> {
  const uid = `${newId()}@foundry`
  return upsertEventByUid(accountId, calendarId, { ...input, uid })
}

export async function updateEvent(
  accountId: string,
  id: string,
  patch: Partial<{
    title: string
    description: string | null
    location: string | null
    startAt: Date
    endAt: Date
    allDay: boolean
  }>,
): Promise<CalEvent | null> {
  const existing = await getEvent(accountId, id)
  if (!existing) return null

  const now = new Date()
  const uid = existing.icalUid ?? `${id}@foundry`
  const tag = etag(uid, now)

  const [row] = await db<CalEvent[]>`
    UPDATE calendar_events SET
      title       = ${patch.title ?? existing.title},
      description = ${patch.description !== undefined ? patch.description : existing.description},
      location    = ${patch.location !== undefined ? patch.location : existing.location},
      start_at    = ${patch.startAt ?? existing.startAt},
      end_at      = ${patch.endAt ?? existing.endAt},
      all_day     = ${patch.allDay ?? existing.allDay},
      etag        = ${tag},
      sequence    = ${existing.sequence + 1},
      updated_at  = ${now}
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `
  if (row?.calendarId) await touchCalendarCtag(row.calendarId)
  return row ?? null
}

export async function deleteEvent(accountId: string, id: string): Promise<boolean> {
  const existing = await getEvent(accountId, id)
  const result = await db`
    DELETE FROM calendar_events WHERE id = ${id} AND account_id = ${accountId}
  `
  if (existing?.calendarId) await touchCalendarCtag(existing.calendarId)
  return result.count > 0
}

export async function deleteEventByUid(accountId: string, uid: string): Promise<boolean> {
  const existing = await getEventByUid(accountId, uid)
  if (!existing) return false
  return deleteEvent(accountId, existing.id)
}

// ── App passwords ────────────────────────────────────────────────────────────

export interface AppPassword {
  id: string
  accountId: string
  label: string
  token: string
  lastUsedAt: Date | null
  createdAt: Date
}

export async function createAppPassword(accountId: string, label: string): Promise<AppPassword> {
  const id = newId()
  const token = `fp_${createHash('sha256').update(`${accountId}:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 32)}`
  const [row] = await db<AppPassword[]>`
    INSERT INTO caldav_app_passwords (id, account_id, label, token)
    VALUES (${id}, ${accountId}, ${label}, ${token})
    RETURNING *
  `
  return row
}

export async function listAppPasswords(accountId: string): Promise<Omit<AppPassword, 'token'>[]> {
  return db`
    SELECT id, account_id, label, last_used_at, created_at
    FROM caldav_app_passwords WHERE account_id = ${accountId} ORDER BY created_at DESC
  `
}

export async function deleteAppPassword(accountId: string, id: string): Promise<boolean> {
  const result = await db`
    DELETE FROM caldav_app_passwords WHERE id = ${id} AND account_id = ${accountId}
  `
  return result.count > 0
}

export async function verifyAppPassword(
  token: string,
): Promise<{ accountId: string; email: string } | null> {
  const [row] = await db<{ account_id: string; domain: string }[]>`
    SELECT p.account_id, a.domain
    FROM caldav_app_passwords p
    JOIN accounts a ON a.id = p.account_id
    WHERE p.token = ${token}
  `
  if (!row) return null
  await db`UPDATE caldav_app_passwords SET last_used_at = NOW() WHERE token = ${token}`
  return { accountId: row.account_id, email: row.domain }
}
