'use client'

import { useState, useEffect } from 'react'
import type { CalendarEvent } from '@foundry/shared'
import { updateCalendarEvent } from '../lib/api'

function XIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
function TrashIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
}

interface Props {
  event?: CalendarEvent | null
  defaultDate?: string
  onSave: (data: {
    title: string; description?: string; location?: string
    startAt: string; endAt: string; allDay: boolean
  }) => Promise<void>
  onDelete?: () => void
  onClose: () => void
}

function toLocalDatetime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toLocalDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function EventModal({ event, defaultDate, onSave, onDelete, onClose }: Props) {
  const isEdit = !!event

  const defaultStart = defaultDate ? new Date(defaultDate) : (() => {
    const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d
  })()
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000)

  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [allDay, setAllDay] = useState(event?.allDay ?? false)
  const [startAt, setStartAt] = useState(
    event ? (event.allDay ? toLocalDate(new Date(event.startAt)) : toLocalDatetime(new Date(event.startAt)))
           : toLocalDatetime(defaultStart),
  )
  const [endAt, setEndAt] = useState(
    event ? (event.allDay ? toLocalDate(new Date(event.endAt)) : toLocalDatetime(new Date(event.endAt)))
           : toLocalDatetime(defaultEnd),
  )
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // When allDay toggles, reformat the date inputs
  useEffect(() => {
    try {
      const s = allDay ? toLocalDate(new Date(startAt)) : toLocalDatetime(new Date(startAt))
      const e = allDay ? toLocalDate(new Date(endAt)) : toLocalDatetime(new Date(endAt))
      setStartAt(s)
      setEndAt(e)
    } catch {}
  }, [allDay]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      const startDate = allDay ? new Date(startAt + 'T00:00:00') : new Date(startAt)
      const endDate = allDay ? new Date(endAt + 'T00:00:00') : new Date(endAt)

      if (isEdit && event) {
        await updateCalendarEvent(event.id, {
          title: title.trim(),
          description: description || null,
          location: location || null,
          startAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
          allDay,
        })
        await onSave({ title: title.trim(), description: description || undefined, location: location || undefined, startAt: startDate.toISOString(), endAt: endDate.toISOString(), allDay })
      } else {
        await onSave({
          title: title.trim(),
          description: description || undefined,
          location: location || undefined,
          startAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
          allDay,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors'
  const labelClass = 'block text-xs font-medium text-fg-secondary mb-1'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-bg-base border border-border rounded-xl shadow-card w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm text-fg-primary">{isEdit ? 'Edit event' : 'New event'}</h2>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover transition-colors">
            <XIcon />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              className={inputClass + ' text-base font-medium'}
              autoFocus
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="accent-accent"
            />
            <label htmlFor="allDay" className="text-xs text-fg-secondary cursor-pointer">All day</label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Start</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>End</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description"
              rows={3}
              className={inputClass + ' resize-none'}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <div>
              {onDelete && !confirmDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 text-xs text-danger hover:text-danger/80 transition-colors"
                >
                  <TrashIcon /> Delete
                </button>
              )}
              {confirmDelete && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-danger">Delete this event?</span>
                  <button type="button" onClick={onDelete} className="text-xs font-medium text-danger hover:underline">Yes</button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-fg-secondary hover:underline">Cancel</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="text-sm text-fg-secondary hover:text-fg-primary transition-colors px-3 py-1.5">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="bg-accent hover:bg-accent-hover text-accent-fg font-medium text-sm px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
