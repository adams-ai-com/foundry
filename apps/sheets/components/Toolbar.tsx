'use client'

import { IconButton, Separator } from '@foundry/ui'

interface ToolbarProps {
  onTogglePython: () => void
  pythonOpen: boolean
}

export function Toolbar({ onTogglePython, pythonOpen }: ToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 bg-white border-b border-gray-200 flex-wrap">
      <span className="font-semibold text-sm text-gray-700 mr-2">Foundry Sheets</span>

      <Separator />

      <IconButton label="Bold" onClick={() => {}}>
        <strong>B</strong>
      </IconButton>
      <IconButton label="Italic" onClick={() => {}}>
        <em>I</em>
      </IconButton>
      <IconButton label="Underline" onClick={() => {}}>
        <span className="underline">U</span>
      </IconButton>

      <Separator />

      <select className="text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
        <option>General</option>
        <option>Number</option>
        <option>Currency</option>
        <option>Percent</option>
        <option>Date</option>
      </select>

      <Separator />

      <IconButton
        label="Python scripting"
        active={pythonOpen}
        onClick={onTogglePython}
      >
        🐍
      </IconButton>

      <div className="ml-auto flex items-center gap-1">
        <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">
          Import .xlsx
        </button>
        <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">
          Export .xlsx
        </button>
      </div>
    </div>
  )
}
