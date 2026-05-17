'use client'

import { useState } from 'react'

interface ComposeModalProps {
  onClose: () => void
}

export function ComposeModal({ onClose }: ComposeModalProps) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  return (
    <div className="fixed bottom-4 right-4 w-[480px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-700 rounded-t-xl">
        <span className="text-white text-sm font-medium">New message</span>
        <button onClick={onClose} className="text-gray-300 hover:text-white text-lg leading-none">×</button>
      </div>

      <div className="border-b border-gray-200 px-4 py-2">
        <input
          placeholder="To"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-full text-sm outline-none"
        />
      </div>
      <div className="border-b border-gray-200 px-4 py-2">
        <input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full text-sm outline-none"
        />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="flex-1 px-4 py-3 text-sm outline-none resize-none min-h-[200px]"
        placeholder="Compose email"
      />
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
        <button
          className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 transition-colors font-medium"
          onClick={() => { alert('JMAP send — wire lib/jmap-client.ts'); onClose() }}
        >
          Send
        </button>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">Discard</button>
      </div>
    </div>
  )
}
