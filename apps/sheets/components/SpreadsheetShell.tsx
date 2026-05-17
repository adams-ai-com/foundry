'use client'

import { useState } from 'react'
import { Grid } from './Grid'
import { FormulaBar } from './FormulaBar'
import { Toolbar } from './Toolbar'
import { PythonPanel } from './PythonPanel'
import type { CellAddress } from '@foundry/shared'

export function SpreadsheetShell() {
  const [selected, setSelected] = useState<CellAddress>({ sheet: 'Sheet1', row: 0, col: 0 })
  const [pythonOpen, setPythonOpen] = useState(false)

  return (
    <div className="h-screen flex flex-col select-none">
      <Toolbar onTogglePython={() => setPythonOpen((v) => !v)} pythonOpen={pythonOpen} />
      <FormulaBar selected={selected} />
      <div className="flex flex-1 overflow-hidden">
        <Grid selected={selected} onSelect={setSelected} />
        {pythonOpen && (
          <div className="w-96 border-l border-gray-200 flex-shrink-0">
            <PythonPanel />
          </div>
        )}
      </div>
      {/* Sheet tabs */}
      <div className="flex items-center border-t border-gray-200 bg-gray-50 px-2 h-8 gap-1">
        <button className="text-xs px-3 py-0.5 rounded bg-white border border-gray-300 font-medium shadow-sm">
          Sheet1
        </button>
        <button className="text-xs px-2 py-0.5 text-gray-400 hover:text-gray-600">+ Add sheet</button>
      </div>
    </div>
  )
}
