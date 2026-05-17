'use client'

import { useRef } from 'react'
import { IconButton, Separator } from '@foundry/ui'
import { useHyperFormulaContext } from '@/lib/hyperformula-context'
import { importXlsx, exportXlsx } from '@/lib/xlsx-io'
import type { CellAddress } from '@foundry/shared'
import type { CellFormat } from '@/lib/actions'

interface ToolbarProps {
  selected: CellAddress
  onTogglePython: () => void
  pythonOpen: boolean
}

export function Toolbar({ selected, onTogglePython, pythonOpen }: ToolbarProps) {
  const { getCellFormat, setCellFormat, getSerializedData, getSheetNames, loadAll } = useHyperFormulaContext()
  const fmt = getCellFormat(selected)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function toggleFormat(key: keyof Pick<CellFormat, 'bold' | 'italic' | 'underline'>) {
    setCellFormat(selected, { [key]: !fmt[key] })
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const sheets = await importXlsx(file)
    const data = Object.fromEntries(sheets.map(s => [s.name, s.data]))
    loadAll(data, {})
  }

  async function handleExport() {
    const data = getSerializedData()
    const names = getSheetNames()
    const sheets = names.map(name => ({
      name,
      data: (data[name] ?? []) as (string | number | null)[][],
    }))
    const blob = await exportXlsx(sheets)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'spreadsheet.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 bg-white border-b border-gray-200 flex-wrap">
      <span className="font-semibold text-sm text-gray-700 mr-2">Foundry Sheets</span>

      <Separator />

      <IconButton label="Bold (Ctrl+B)" active={!!fmt.bold} onClick={() => toggleFormat('bold')}>
        <strong>B</strong>
      </IconButton>
      <IconButton label="Italic (Ctrl+I)" active={!!fmt.italic} onClick={() => toggleFormat('italic')}>
        <em>I</em>
      </IconButton>
      <IconButton label="Underline (Ctrl+U)" active={!!fmt.underline} onClick={() => toggleFormat('underline')}>
        <span className="underline">U</span>
      </IconButton>

      <Separator />

      <select
        className="text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        value={fmt.numFormat ?? 'general'}
        onChange={(e) => setCellFormat(selected, { numFormat: e.target.value as CellFormat['numFormat'] })}
      >
        <option value="general">General</option>
        <option value="number">Number</option>
        <option value="currency">Currency</option>
        <option value="percent">Percent</option>
        <option value="date">Date</option>
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleImport}
        />
        <button
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          onClick={() => fileInputRef.current?.click()}
        >
          Import
        </button>
        <button
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          onClick={handleExport}
        >
          Export
        </button>
      </div>
    </div>
  )
}
