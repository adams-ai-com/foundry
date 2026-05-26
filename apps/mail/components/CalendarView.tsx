'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CalendarEvent } from '@foundry/shared'
import { listCalendarEvents, createCalendarEvent, deleteCalendarEvent } from '../lib/api'
import { EventModal } from './EventModal'
import { AppPasswordModal } from './AppPasswordModal'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

type CalView = 'month' | 'week'

function ChevronLeft() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="15 18 9 12 15 6"/></svg>
}
function ChevronRight() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="9 18 15 12 9 6"/></svg>
}
function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}

function formatTime(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${ampm}` : `${hour}:${m.toString().padStart(2, '0')}${ampm}`
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function CalendarView() {
  const today = new Date()
  const [view, setView] = useState<CalView>('month')
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined)
  const [syncModalOpen, setSyncModalOpen] = useState(false)

  const fetchEvents = useCallback(() => {
    let start: string, end: string
    if (view === 'month') {
      start = new Date(year, month, 1).toISOString()
      end = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    } else {
      start = weekStart.toISOString()
      end = addDays(weekStart, 7).toISOString()
    }
    listCalendarEvents(start, end).then(setEvents).catch(() => setEvents([]))
  }, [view, year, month, weekStart])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }
  const prevWeek = () => setWeekStart(w => addDays(w, -7))
  const nextWeek = () => setWeekStart(w => addDays(w, 7))
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); setWeekStart(startOfWeek(today)) }

  const openNew = (dateStr?: string) => { setEditEvent(null); setDefaultDate(dateStr); setModalOpen(true) }
  const openEdit = (e: CalendarEvent) => { setEditEvent(e); setDefaultDate(undefined); setModalOpen(true) }

  const handleSave = async (data: {
    title: string; description?: string; location?: string
    startAt: string; endAt: string; allDay: boolean
  }) => {
    if (editEvent) {
      // update handled inside EventModal via updateCalendarEvent
    } else {
      await createCalendarEvent(data)
    }
    fetchEvents()
    setModalOpen(false)
  }

  const handleDelete = async (id: string) => {
    await deleteCalendarEvent(id)
    fetchEvents()
    setModalOpen(false)
  }

  const weekLabel = () => {
    const end = addDays(weekStart, 6)
    if (weekStart.getMonth() === end.getMonth()) {
      return `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}–${end.getDate()}, ${weekStart.getFullYear()}`
    }
    return `${SHORT_MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${SHORT_MONTHS[end.getMonth()]} ${end.getDate()}, ${weekStart.getFullYear()}`
  }

  return (
    <div data-testid="calendar-view" className="flex-1 flex flex-col bg-bg-base overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0 bg-bg-surface">
        <div className="flex items-center gap-2">
          <button
            onClick={view === 'month' ? prevMonth : prevWeek}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-fg-secondary hover:text-fg-primary transition-colors"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={view === 'month' ? nextMonth : nextWeek}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-fg-secondary hover:text-fg-primary transition-colors"
          >
            <ChevronRight />
          </button>
          <h2 className="text-sm font-semibold text-fg-primary ml-1">
            {view === 'month' ? `${MONTHS[month]} ${year}` : weekLabel()}
          </h2>
          <button
            onClick={goToday}
            className="ml-1 text-xs text-fg-secondary hover:text-fg-primary border border-border rounded-lg px-2.5 py-1 hover:bg-bg-hover transition-colors"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {(['month', 'week'] as CalView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 capitalize transition-colors ${view === v ? 'bg-accent text-accent-fg font-medium' : 'text-fg-secondary hover:bg-bg-hover hover:text-fg-primary'}`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSyncModalOpen(true)}
            className="text-xs text-fg-secondary hover:text-fg-primary border border-border rounded-lg px-2.5 py-1.5 hover:bg-bg-hover transition-colors"
            title="CalDAV sync / app passwords"
          >
            Sync
          </button>
          <button
            onClick={() => openNew()}
            className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-accent-fg text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <PlusIcon /> New event
          </button>
        </div>
      </div>

      {/* Month view */}
      {view === 'month' && <MonthGrid year={year} month={month} today={today} events={events} onDayClick={(d) => openNew(d)} onEventClick={openEdit} />}

      {/* Week view */}
      {view === 'week' && <WeekGrid weekStart={weekStart} today={today} events={events} onSlotClick={(d) => openNew(d)} onEventClick={openEdit} />}

      {modalOpen && (
        <EventModal
          event={editEvent}
          defaultDate={defaultDate}
          onSave={handleSave}
          onDelete={editEvent ? () => handleDelete(editEvent.id) : undefined}
          onClose={() => setModalOpen(false)}
        />
      )}

      {syncModalOpen && <AppPasswordModal onClose={() => setSyncModalOpen(false)} />}
    </div>
  )
}

// ── Month grid ────────────────────────────────────────────────────────────────

function MonthGrid({
  year, month, today, events, onDayClick, onEventClick,
}: {
  year: number; month: number; today: Date
  events: CalendarEvent[]
  onDayClick: (dateStr: string) => void
  onEventClick: (e: CalendarEvent) => void
}) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, i) => {
    const day = i - firstDay + 1
    return day >= 1 && day <= daysInMonth ? day : null
  })

  const eventsForDay = (day: number) =>
    events.filter((e) => {
      const d = new Date(e.startAt)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border flex-shrink-0">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-fg-tertiary uppercase tracking-wide py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1 overflow-auto">
        {cells.map((day, i) => {
          const dayEvents = day ? eventsForDay(day) : []
          const isToday = day !== null && sameDay(new Date(year, month, day), today)
          const dateStr = day ? new Date(year, month, day, 9, 0).toISOString() : undefined

          return (
            <div
              key={i}
              onClick={() => day && dateStr && onDayClick(dateStr)}
              className={`border-b border-r border-border p-1.5 min-h-[90px] relative ${day ? 'cursor-pointer hover:bg-bg-surface transition-colors' : 'bg-bg-surface/50'} ${i % 7 === 0 ? 'border-l' : ''}`}
            >
              {day && (
                <>
                  <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium mb-1 ${isToday ? 'bg-accent text-accent-fg' : 'text-fg-secondary'}`}>
                    {day}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <button
                        key={e.id}
                        onClick={(ev) => { ev.stopPropagation(); onEventClick(e) }}
                        title={e.title}
                        className="text-left text-xs bg-accent/15 text-accent rounded px-1.5 py-0.5 truncate hover:bg-accent/25 transition-colors font-medium"
                      >
                        {!e.allDay && <span className="mr-1 opacity-70">{formatTime(new Date(e.startAt))}</span>}
                        {e.title}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-xs text-fg-tertiary px-1">+{dayEvents.length - 3} more</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week grid ─────────────────────────────────────────────────────────────────

function WeekGrid({
  weekStart, today, events, onSlotClick, onEventClick,
}: {
  weekStart: Date; today: Date
  events: CalendarEvent[]
  onSlotClick: (dateStr: string) => void
  onEventClick: (e: CalendarEvent) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const allDayEvents = events.filter((e) => e.allDay)
  const timedEvents = events.filter((e) => !e.allDay)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border flex-shrink-0 bg-bg-surface">
        <div className="py-2" />
        {days.map((day, i) => {
          const isToday = sameDay(day, today)
          return (
            <div key={i} className="text-center py-2 border-l border-border">
              <div className="text-xs text-fg-tertiary uppercase tracking-wide">{DAYS[day.getDay()]}</div>
              <div className={`text-sm font-semibold mx-auto w-7 h-7 flex items-center justify-center rounded-full mt-0.5 ${isToday ? 'bg-accent text-accent-fg' : 'text-fg-primary'}`}>
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* All-day row */}
      {allDayEvents.length > 0 && (
        <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border flex-shrink-0 bg-bg-surface">
          <div className="py-1 text-right pr-2 text-xs text-fg-tertiary self-center">all day</div>
          {days.map((day, i) => {
            const dayEvents = allDayEvents.filter((e) => sameDay(new Date(e.startAt), day))
            return (
              <div key={i} className="border-l border-border p-1 min-h-[28px]">
                {dayEvents.map((e) => (
                  <button key={e.id} onClick={() => onEventClick(e)}
                    className="w-full text-left text-xs bg-accent/15 text-accent rounded px-1.5 py-0.5 truncate hover:bg-accent/25 transition-colors font-medium">
                    {e.title}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-[48px_repeat(7,1fr)]">
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-b border-border py-3 text-right pr-2 text-xs text-fg-tertiary leading-none">
                {hour === 0 ? '' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`}
              </div>
              {days.map((day, di) => {
                const slotEvents = timedEvents.filter((e) => {
                  const start = new Date(e.startAt)
                  return sameDay(start, day) && start.getHours() === hour
                })
                const dateStr = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0).toISOString()
                return (
                  <div
                    key={di}
                    onClick={() => onSlotClick(dateStr)}
                    className="border-b border-l border-border min-h-[48px] p-0.5 cursor-pointer hover:bg-bg-surface transition-colors relative"
                  >
                    {slotEvents.map((e) => (
                      <button
                        key={e.id}
                        onClick={(ev) => { ev.stopPropagation(); onEventClick(e) }}
                        className="w-full text-left text-xs bg-accent/15 text-accent rounded px-1.5 py-1 truncate hover:bg-accent/25 transition-colors font-medium"
                      >
                        <div>{formatTime(new Date(e.startAt))}</div>
                        <div>{e.title}</div>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
