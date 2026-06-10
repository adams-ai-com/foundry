// CalDAV XML response builders
// Namespaces: DAV: (D), urn:ietf:params:xml:ns:caldav (C)

const NS = 'xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/"'

function wrap(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\r\n<D:multistatus ${NS}>${body}</D:multistatus>`
}

function propstat(props: string, status = '200'): string {
  const statusLine = status === '200' ? 'HTTP/1.1 200 OK' : `HTTP/1.1 ${status} Not Found`
  return `<D:propstat><D:prop>${props}</D:prop><D:status>${statusLine}</D:status></D:propstat>`
}

function response(href: string, ...propstats: string[]): string {
  return `<D:response><D:href>${href}</D:href>${propstats.join('')}</D:response>`
}

// ── OPTIONS / discovery ───────────────────────────────────────────────────────

export function optionsHeaders(): Record<string, string> {
  return {
    'DAV': '1, 2, 3, calendar-access',
    'Allow': 'OPTIONS, GET, PUT, DELETE, PROPFIND, REPORT, MKCALENDAR',
    'Content-Length': '0',
  }
}

// ── Root / well-known ─────────────────────────────────────────────────────────

export function currentUserPrincipal(href: string, principalHref: string): string {
  return wrap(response(href, propstat(`<D:current-user-principal><D:href>${principalHref}</D:href></D:current-user-principal>`)))
}

// ── Principal resource ────────────────────────────────────────────────────────

export function principalResponse(
  principalHref: string,
  displayName: string,
  calendarHomeHref: string,
): string {
  const props = [
    `<D:displayname>${displayName}</D:displayname>`,
    `<D:resourcetype><D:principal/></D:resourcetype>`,
    `<C:calendar-home-set><D:href>${calendarHomeHref}</D:href></C:calendar-home-set>`,
    `<D:current-user-principal><D:href>${principalHref}</D:href></D:current-user-principal>`,
  ].join('')
  return wrap(response(principalHref, propstat(props)))
}

// ── Calendar home ─────────────────────────────────────────────────────────────

export interface CalendarDesc {
  id: string
  name: string
  color: string
  ctag: string
  href: string
}

export function calendarHomeResponse(homeHref: string, calendars: CalendarDesc[]): string {
  const homeResponse = response(
    homeHref,
    propstat(`<D:resourcetype><D:collection/></D:resourcetype><D:displayname>Calendars</D:displayname>`),
  )

  const calResponses = calendars.map((cal) =>
    response(
      cal.href,
      propstat([
        `<D:displayname>${cal.name}</D:displayname>`,
        `<D:resourcetype><D:collection/><C:calendar/></D:resourcetype>`,
        `<C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>`,
        `<CS:getctag>${cal.ctag}</CS:getctag>`,
        `<D:sync-token>${cal.ctag}</D:sync-token>`,
      ].join('')),
    ),
  )

  return wrap([homeResponse, ...calResponses].join(''))
}

// ── Calendar (with event listing at Depth:1) ──────────────────────────────────

export interface EventDesc {
  uid: string
  etag: string
  href: string
  calendarData?: string
}

export function calendarResponse(
  calendarHref: string,
  cal: CalendarDesc,
  events: EventDesc[],
  includeData: boolean,
): string {
  const calProps = [
    `<D:displayname>${cal.name}</D:displayname>`,
    `<D:resourcetype><D:collection/><C:calendar/></D:resourcetype>`,
    `<CS:getctag>${cal.ctag}</CS:getctag>`,
  ].join('')

  const calResponse = response(calendarHref, propstat(calProps))

  const eventResponses = events.map((e) => {
    const props = includeData && e.calendarData
      ? [
          `<D:getetag>"${e.etag}"</D:getetag>`,
          `<D:getcontenttype>text/calendar; charset=utf-8</D:getcontenttype>`,
          `<C:calendar-data>${e.calendarData}</C:calendar-data>`,
        ].join('')
      : [
          `<D:getetag>"${e.etag}"</D:getetag>`,
          `<D:getcontenttype>text/calendar; charset=utf-8</D:getcontenttype>`,
        ].join('')
    return response(e.href, propstat(props))
  })

  return wrap([calResponse, ...eventResponses].join(''))
}

// ── REPORT response (calendar-query / multiget) ───────────────────────────────

export function reportResponse(events: EventDesc[]): string {
  const responses = events.map((e) => {
    if (!e.calendarData) {
      return response(e.href, propstat('', '404'))
    }
    const props = [
      `<D:getetag>"${e.etag}"</D:getetag>`,
      `<C:calendar-data>${e.calendarData}</C:calendar-data>`,
    ].join('')
    return response(e.href, propstat(props))
  })
  return wrap(responses.join(''))
}

// ── Single event (for PROPFIND on a .ics resource) ───────────────────────────

export function eventPropfindResponse(href: string, etag: string): string {
  const props = [
    `<D:getetag>"${etag}"</D:getetag>`,
    `<D:getcontenttype>text/calendar; charset=utf-8</D:getcontenttype>`,
    `<D:resourcetype/>`,
  ].join('')
  return wrap(response(href, propstat(props)))
}

// ── Error responses ───────────────────────────────────────────────────────────

export function notFound(href: string): string {
  return wrap(response(href, propstat('', '404')))
}
