// CalDAV client — wraps tsdav for Stalwart Mail calendar access

import { createDAVClient } from 'tsdav'
import type { CalendarEvent } from '@foundry/shared'

export interface CalDAVConfig {
  serverUrl: string
  username: string
  password: string
}

export async function getCalDAVClient(config: CalDAVConfig) {
  return createDAVClient({
    serverUrl: config.serverUrl,
    credentials: {
      username: config.username,
      password: config.password,
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  })
}

export async function fetchEvents(
  config: CalDAVConfig,
  start: Date,
  end: Date
): Promise<CalendarEvent[]> {
  const client = await getCalDAVClient(config)
  const calendars = await client.fetchCalendars()
  const events: CalendarEvent[] = []

  for (const calendar of calendars) {
    const objects = await client.fetchCalendarObjects({
      calendar,
      timeRange: { start: start.toISOString(), end: end.toISOString() },
    })

    for (const obj of objects) {
      // Parse iCalendar data — ical.js handles this
      // Placeholder: return raw objects for now
      events.push({
        id: obj.url,
        title: 'Event',
        start,
        end,
        allDay: false,
        attendees: [],
      })
    }
  }

  return events
}
