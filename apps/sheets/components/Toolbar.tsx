'use client'

import { useRef } from 'react'
import { IconButton, Separator } from '@foundry/ui'
import { useHyperFormulaContext } from '@/lib/hyperformula-context'
import { importXlsx, exportXlsx, parseCSV, serializeCSV } from '@/lib/xlsx-io'
import { ColorPicker } from './ColorPicker'
import type { CellAddress } from '@foundry/shared'
import type { CellFormat } from '@/lib/actions'

interface ToolbarProps {
  selected: CellAddress
  selectionEnd: CellAddress | null
  onTogglePython: () => void
  onToggleChart: () => void
  pythonOpen: boolean
  chartOpen: boolean
  frozenRows: number
  frozenCols: number
  onToggleFreezeRows: () => void
  onToggleFreezeCols: () => void
}

export function Toolbar({ selected, selectionEnd, onTogglePython, onToggleChart, pythonOpen, chartOpen, frozenRows, frozenCols, onToggleFreezeRows, onToggleFreezeCols }: ToolbarProps) {
  const { getCellFormat, setRangeFormat, getSerializedData, getSheetNames, loadAll, undo, redo, canUndo, canRedo } = useHyperFormulaContext()
  const fmt = getCellFormat(selected)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function toggleFormat(key: keyof Pick<CellFormat, 'bold' | 'italic' | 'underline' | 'strikethrough'>) {
    setRangeFormat(selected, selectionEnd, { [key]: !fmt[key] })
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
    <div className="flex items-center gap-0.5 px-3 py-1.5 bg-bg-raised border-b border-border flex-wrap shrink-0">
      <IconButton data-testid="btn-undo" label="Undo (Ctrl+Z)" active={false} onClick={undo} disabled={!canUndo()}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 010 16H3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l4-4m-4 4l4 4" />
        </svg>
      </IconButton>
      <IconButton data-testid="btn-redo" label="Redo (Ctrl+Y)" active={false} onClick={redo} disabled={!canRedo()}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a8 8 0 000 16h10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 10l-4-4m4 4l-4 4" />
        </svg>
      </IconButton>

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
      <IconButton data-testid="btn-strikethrough" label="Strikethrough" active={!!fmt.strikethrough} onClick={() => toggleFormat('strikethrough')}>
        <span className="line-through">S</span>
      </IconButton>

      <Separator />

      <IconButton data-testid="btn-align-left" label="Align left" active={!fmt.align || fmt.align === 'left'} onClick={() => setRangeFormat(selected, selectionEnd, { align: 'left' })}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M3 6h18M3 10h10M3 14h18M3 18h10"/>
        </svg>
      </IconButton>
      <IconButton data-testid="btn-align-center" label="Align center" active={fmt.align === 'center'} onClick={() => setRangeFormat(selected, selectionEnd, { align: 'center' })}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M3 6h18M7 10h10M3 14h18M7 18h10"/>
        </svg>
      </IconButton>
      <IconButton data-testid="btn-align-right" label="Align right" active={fmt.align === 'right'} onClick={() => setRangeFormat(selected, selectionEnd, { align: 'right' })}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M3 6h18M11 10h10M3 14h18M11 18h10"/>
        </svg>
      </IconButton>

      <Separator />

      <ColorPicker
        value={fmt.color}
        onChange={(color) => setRangeFormat(selected, selectionEnd, { color })}
        label="Font color"
      >
        <span className="text-xs font-bold leading-none" style={{ color: fmt.color ?? 'rgb(var(--fg-primary))' }}>A</span>
      </ColorPicker>

      <ColorPicker
        value={fmt.fillColor}
        onChange={(fillColor) => setRangeFormat(selected, selectionEnd, { fillColor })}
        label="Fill color"
      >
        <svg className="w-3.5 h-3.5 text-fg-secondary" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v1h3l4 4-7 7H7z"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 7l-7 7"/>
        </svg>
      </ColorPicker>

      <Separator />

      {/* Freeze row 1 */}
      <IconButton data-testid="btn-freeze-rows" label={frozenRows ? 'Unfreeze row' : 'Freeze row 1'} active={frozenRows > 0} onClick={onToggleFreezeRows}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 6v12M20 6v12"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h16" strokeWidth={1.5} strokeDasharray="2 2"/>
        </svg>
      </IconButton>
      {/* Freeze col A */}
      <IconButton data-testid="btn-freeze-cols" label={frozenCols ? 'Unfreeze column' : 'Freeze column A'} active={frozenCols > 0} onClick={onToggleFreezeCols}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 4v16M6 4h12M6 20h12"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 4v16" strokeWidth={1.5} strokeDasharray="2 2"/>
        </svg>
      </IconButton>

      <Separator />

      <select
        data-testid="select-numformat"
        className="text-xs border border-border rounded px-1 py-0.5 bg-bg-surface text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent"
        value={fmt.numFormat ?? 'general'}
        onChange={(e) => setRangeFormat(selected, null, { numFormat: e.target.value as CellFormat['numFormat'] })}
      >
        <option value="general">General</option>
        <option value="number">Number</option>
        <option value="currency">Currency</option>
        <option value="percent">Percent</option>
        <option value="date">Date</option>
      </select>

      <Separator />

      <IconButton data-testid="btn-chart" label="Charts" active={chartOpen} onClick={onToggleChart}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </IconButton>

      <IconButton data-testid="btn-python" label="Python scripting" active={pythonOpen} onClick={onTogglePython}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 7 3.13 7 5v2h5v1H5.5C3.57 8 2 9.57 2 11.5v3C2 16.43 3.57 18 5.5 18H7v-2c0-1.93 1.07-3 3-3h4c1.93 0 3-1.07 3-3V5c0-1.87-1.13-3-5-3zm-1 2a1 1 0 110 2 1 1 0 010-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c3.87 0 5-1.13 5-3v-2h-5v-1h6.5c1.93 0 3.5-1.57 3.5-3.5v-3C22 7.57 20.43 6 18.5 6H17v2c0 1.93-1.07 3-3 3H10c-1.93 0-3 1.07-3 3v4c0 1.87 1.13 3 5 3zm1-2a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </IconButton>

      <div className="ml-auto flex items-center gap-1">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
        <button
          data-testid="btn-import"
          className="text-xs text-fg-secondary hover:text-fg-primary px-2 py-1 rounded hover:bg-bg-hover transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          Import
        </button>
        <span className="text-xs text-fg-tertiary">|</span>
        <button
          data-testid="btn-export-xlsx"
          className="text-xs text-fg-secondary hover:text-fg-primary px-2 py-1 rounded hover:bg-bg-hover transition-colors"
          onClick={handleExportXlsx}
        >
          xlsx
        </button>
        <button
          data-testid="btn-export-csv"
          className="text-xs text-fg-secondary hover:text-fg-primary px-2 py-1 rounded hover:bg-bg-hover transition-colors"
          onClick={handleExportCsv}
        >
          csv
        </button>
      </div>
    </div>
  )
}
