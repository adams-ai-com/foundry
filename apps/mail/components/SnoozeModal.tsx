'use client'

import { useState } from 'react'

interface SnoozeModalProps {
  onSnooze: (until: string) => void
  onClose: () => void
}

function nextWeekday(day: number, hour: number): Date {
  const d = new Date()
  const diff = (day - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + diff)
  d.setHours(hour, 0, 0, 0)
  return d
}

export function SnoozeModal({ onSnooze, onClose }: SnoozeModalProps) {
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('08:00')

  const now = new Date()
  const laterToday = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const tomorrowMorning = new Date(now)
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1)
  tomorrowMorning.setHours(8, 0, 0, 0)
  const thisWeekend = nextWeekday(6, 9)
  const nextMonday = nextWeekday(1, 8)

  const presets = [
    { label: 'Later today', sub: laterToday.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), date: laterToday },
    { label: 'Tomorrow morning', sub: tomorrowMorning.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' · 8:00 AM', date: tomorrowMorning },
    { label: 'This weekend', sub: thisWeekend.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' · 9:00 AM', date: thisWeekend },
    { label: 'Next week', sub: nextMonday.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' · 8:00 AM', date: nextMonday },
  ]

  const handleCustom = () => {
    if (!customDate) return
    const dt = new Date(`${customDate}T${customTime}`)
    if (!isNaN(dt.getTime())) onSnooze(dt.toISOString())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-72 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800">Snooze until…</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <div className="py-1">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => onSnooze(p.date.toISOString())}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-left transition-colors"
            >
              <span className="text-sm font-medium text-gray-800">{p.label}</span>
              <span className="text-xs text-gray-400">{p.sub}</span>
            </button>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-2 font-medium">Custom time</div>
          <div className="flex gap-2">
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400"
            />
            <input
              type="time"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              className="w-20 text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={handleCustom}
            disabled={!customDate}
            className="mt-2 w-full text-xs bg-blue-600 text-white rounded py-1.5 hover:bg-blue-700 transition-colors disabled:opacity-40"
          >
            Snooze
          </button>
        </div>
      </div>
    </div>
  )
}
