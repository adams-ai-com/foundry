'use client'

import { useRef } from 'react'
import { IconButton, Separator } from '@foundry/ui'
import { useHyperFormulaContext } from '@/lib/hyperformula-context'
import { importXlsx, exportXlsx, parseCSV, serializeCSV } from '@/lib/xlsx-io'
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
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      const text = await file.text()
      loadAll({ Sheet1: parseCSV(text) }, {})
    } else {
      const sheets = await importXlsx(file)
      loadAll(Object.fromEntries(sheets.map(s => [s.name, s.data])), {})
    }
  }

  async function handleExportXlsx() {
    const data = getSerializedData()
    const sheets = getSheetNames().map(name => ({
      name,
      data: (data[name] ?? []) as (string | number | null)[][],
    }))
    const blob = await exportXlsx(sheets)
    triggerDownload(blob, 'spreadsheet.xlsx')
  }

  function handleExportCsv() {
    const data = getSerializedData()
    const firstName = getSheetNames()[0] ?? 'Sheet1'
    const csv = serializeCSV((data[firstName] ?? []) as (string | number | boolean | null)[][])
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'spreadsheet.csv')
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 bg-white border-b border-gray-200 flex-wrap">
      <span className="font-semibold text-sm text-gray-700 mr-2">Foundry Sheets</span>

      <Separator />

      <IconButton data-testid="btn-bold" label="Bold (Ctrl+B)" active={!!fmt.bold} onClick={() => toggleFormat('bold')}>
        <strong>B</strong>
      </IconButton>
      <IconButton data-testid="btn-italic" label="Italic (Ctrl+I)" active={!!fmt.italic} onClick={() => toggleFormat('italic')}>
        <em>I</em>
      </IconButton>
      <IconButton data-testid="btn-underline" label="Underline (Ctrl+U)" active={!!fmt.underline} onClick={() => toggleFormat('underline')}>
        <span className="underline">U</span>
      </IconButton>

      <Separator />

      <select
        data-testid="select-numformat"
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
        data-testid="btn-python"
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
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleImport}
        />
        <button
          data-testid="btn-import"
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          onClick={() => fileInputRef.current?.click()}
        >
          Import
        </button>
        <span className="text-xs text-gray-300">|</span>
        <button
          data-testid="btn-export-xlsx"
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          onClick={handleExportXlsx}
        >
          xlsx
        </button>
        <button
          data-testid="btn-export-csv"
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          onClick={handleExportCsv}
        >
          csv
        </button>
      </div>
    </div>
  )
}
