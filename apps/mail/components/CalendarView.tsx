'use client'

import { useState } from 'react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function CalendarView() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  )

  const prev = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const next = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{MONTHS[month]} {year}</h2>
        <div className="flex gap-1">
          <button onClick={prev} className="px-3 py-1.5 rounded hover:bg-gray-100 text-sm">‹</button>
          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }} className="px-3 py-1.5 rounded hover:bg-gray-100 text-sm">Today</button>
          <button onClick={next} className="px-3 py-1.5 rounded hover:bg-gray-100 text-sm">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-xs font-medium text-gray-400 text-center py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 flex-1 border-t border-l border-gray-200">
        {cells.map((day, i) => (
          <div
            key={i}
            className={`border-b border-r border-gray-200 p-1 min-h-[80px] ${!day ? 'bg-gray-50' : 'hover:bg-gray-50 cursor-pointer'}`}
          >
            {day && (
              <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-gray-700'
              }`}>
                {day}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
