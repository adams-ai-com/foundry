'use client'

import { useEffect, useState } from 'react'
import { Grid } from './Grid'
import { FormulaBar } from './FormulaBar'
import { FindBar } from './FindBar'
import { Toolbar } from './Toolbar'
import { StatusBar } from './StatusBar'
import { ContextMenu } from './ContextMenu'
import { PythonPanel } from './PythonPanel'
import { ChartPanel } from './ChartPanel'
import { HyperFormulaProvider, useHyperFormulaContext } from '@/lib/hyperformula-context'
import type { CellAddress } from '@foundry/shared'
import type { SheetData, CellFormats, ChartDef } from '@/lib/actions'
import { ROWS, COLS } from '@/lib/sheet-constants'

interface SpreadsheetShellProps {
  initialData?: SheetData
  initialFormats?: CellFormats
  initialCharts?: ChartDef[]
  onChange?: (data: SheetData) => void
  onFormatsChange?: (formats: CellFormats) => void
  onChartsChange?: (charts: ChartDef[]) => void
}

export function SpreadsheetShell({
  initialData,
  initialFormats,
  initialCharts,
  onChange,
  onFormatsChange,
  onChartsChange,
}: SpreadsheetShellProps) {
  const firstSheet = Object.keys(initialData ?? {})[0] ?? 'Sheet1'
  const [activeSheet, setActiveSheet] = useState(firstSheet)
  const [selected, setSelected] = useState<CellAddress>({ sheet: firstSheet, row: 0, col: 0 })
  const [selectionEnd, setSelectionEnd] = useState<CellAddress | null>(null)
  const [pythonOpen, setPythonOpen] = useState(false)
  const [chartOpen, setChartOpen] = useState(false)
  const [charts, setCharts] = useState<ChartDef[]>(initialCharts ?? [])

  function handleSelect(addr: CellAddress) {
    setSelected(addr)
    setSelectionEnd(null)
  }

  function handleSheetSwitch(name: string) {
    setActiveSheet(name)
    setSelected({ sheet: name, row: 0, col: 0 })
    setSelectionEnd(null)
  }

  function handleChartsChange(updated: ChartDef[]) {
    setCharts(updated)
    onChartsChange?.(updated)
  }

  const selection = selectionEnd ? { start: selected, end: selectionEnd } : null

  return (
    <HyperFormulaProvider initialData={initialData} initialFormats={initialFormats} onChange={onChange} onFormatsChange={onFormatsChange}>
      <SheetContent
        activeSheet={activeSheet}
        selected={selected}
        selectionEnd={selectionEnd}
        pythonOpen={pythonOpen}
        chartOpen={chartOpen}
        charts={charts}
        selection={selection}
        onSelect={handleSelect}
        onSelectionEnd={setSelectionEnd}
        onSheetSwitch={handleSheetSwitch}
        onTogglePython={() => { setPythonOpen(v => !v); setChartOpen(false) }}
        onToggleChart={() => { setChartOpen(v => !v); setPythonOpen(false) }}
        onChartsChange={handleChartsChange}
      />
    </HyperFormulaProvider>
  )
}

interface SheetContentProps {
  activeSheet: string
  selected: CellAddress
  selectionEnd: CellAddress | null
  pythonOpen: boolean
  chartOpen: boolean
  charts: ChartDef[]
  selection: { start: CellAddress; end: CellAddress } | null
  onSelect: (addr: CellAddress) => void
  onSelectionEnd: (addr: CellAddress | null) => void
  onSheetSwitch: (name: string) => void
  onTogglePython: () => void
  onToggleChart: () => void
  onChartsChange: (charts: ChartDef[]) => void
}

function SheetContent({
  activeSheet,
  selected,
  selectionEnd,
  pythonOpen,
  chartOpen,
  charts,
  selection,
  onSelect,
  onSelectionEnd,
  onSheetSwitch,
  onTogglePython,
  onToggleChart,
  onChartsChange,
}: SheetContentProps) {
  const { getSheetNames, addSheet, getCellValue, getCellFormula, setCellValue, addRow, deleteRow, addColumn, deleteColumn, sortColumn } = useHyperFormulaContext()

  // Freeze panes
  const [frozenRows, setFrozenRows] = useState(0)
  const [frozenCols, setFrozenCols] = useState(0)

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ type: 'row' | 'col'; index: number; x: number; y: number } | null>(null)

  // Find & Replace
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [findMatches, setFindMatches] = useState<{ row: number; col: number }[]>([])
  const [findMatchIndex, setFindMatchIndex] = useState(0)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setFindOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function runFind(q: string) {
    setFindQuery(q)
    if (!q.trim()) { setFindMatches([]); setFindMatchIndex(0); return }
    const lower = q.toLowerCase()
    const matches: { row: number; col: number }[] = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const addr: CellAddress = { sheet: activeSheet, row: r, col: c }
        const formula = getCellFormula(addr)
        const val = String(getCellValue(addr) ?? '')
        if ((formula ?? val).toLowerCase().includes(lower)) matches.push({ row: r, col: c })
      }
    }
    setFindMatches(matches)
    setFindMatchIndex(0)
    if (matches.length > 0) onSelect({ sheet: activeSheet, row: matches[0].row, col: matches[0].col })
  }

  function findStep(delta: number) {
    if (!findMatches.length) return
    const idx = (findMatchIndex + delta + findMatches.length) % findMatches.length
    setFindMatchIndex(idx)
    onSelect({ sheet: activeSheet, row: findMatches[idx].row, col: findMatches[idx].col })
  }

  function escapeRe(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function replaceOne() {
    if (!findMatches.length) return
    const m = findMatches[findMatchIndex]
    const addr: CellAddress = { sheet: activeSheet, ...m }
    const formula = getCellFormula(addr)
    const val = String(getCellValue(addr) ?? '')
    setCellValue(addr, (formula ?? val).replace(new RegExp(escapeRe(findQuery), 'i'), replaceQuery))
    runFind(findQuery)
  }

  function replaceAll() {
    if (!findMatches.length) return
    const re = new RegExp(escapeRe(findQuery), 'gi')
    for (const m of [...findMatches]) {
      const addr: CellAddress = { sheet: activeSheet, ...m }
      const formula = getCellFormula(addr)
      const val = String(getCellValue(addr) ?? '')
      setCellValue(addr, (formula ?? val).replace(re, replaceQuery))
    }
    runFind(findQuery)
  }

  function closeFindBar() {
    setFindOpen(false)
    setFindQuery('')
    setReplaceQuery('')
    setFindMatches([])
    setFindMatchIndex(0)
  }

  function handleAddSheet() {
    const names = getSheetNames()
    const name = `Sheet${names.length + 1}`
    addSheet(name)
    onSheetSwitch(name)
  }

  const sheetNames = getSheetNames()

  return (
    <div className="flex-1 flex flex-col select-none overflow-hidden">
      <Toolbar
        selected={selected}
        selectionEnd={selectionEnd}
        onTogglePython={onTogglePython}
        onToggleChart={onToggleChart}
        pythonOpen={pythonOpen}
        chartOpen={chartOpen}
        frozenRows={frozenRows}
        frozenCols={frozenCols}
        onToggleFreezeRows={() => setFrozenRows(v => v > 0 ? 0 : 1)}
        onToggleFreezeCols={() => setFrozenCols(v => v > 0 ? 0 : 1)}
      />
      <FormulaBar selected={selected} selectionEnd={selectionEnd} />
      {findOpen && (
        <FindBar
          query={findQuery}
          replace={replaceQuery}
          matchIndex={findMatchIndex}
          matchCount={findMatches.length}
          onQueryChange={runFind}
          onReplaceChange={setReplaceQuery}
          onPrev={() => findStep(-1)}
          onNext={() => findStep(1)}
          onReplace={replaceOne}
          onReplaceAll={replaceAll}
          onClose={closeFindBar}
        />
      )}

      {ctxMenu && (
        <ContextMenu
          type={ctxMenu.type}
          index={ctxMenu.index}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onInsertBefore={() => {
            if (ctxMenu.type === 'row') addRow(activeSheet, ctxMenu.index)
            else addColumn(activeSheet, ctxMenu.index)
          }}
          onInsertAfter={() => {
            if (ctxMenu.type === 'row') addRow(activeSheet, ctxMenu.index + 1)
            else addColumn(activeSheet, ctxMenu.index + 1)
          }}
          onDelete={() => {
            if (ctxMenu.type === 'row') deleteRow(activeSheet, ctxMenu.index)
            else deleteColumn(activeSheet, ctxMenu.index)
          }}
          onSortAsc={ctxMenu.type === 'col' ? () => sortColumn(activeSheet, ctxMenu.index, true) : undefined}
          onSortDesc={ctxMenu.type === 'col' ? () => sortColumn(activeSheet, ctxMenu.index, false) : undefined}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        <Grid
          selected={selected}
          selectionEnd={selectionEnd}
          onSelect={onSelect}
          onSelectionEnd={onSelectionEnd}
          findMatches={findOpen ? findMatches : undefined}
          findMatchIndex={findOpen ? findMatchIndex : undefined}
          frozenRows={frozenRows}
          frozenCols={frozenCols}
          onContextMenu={(type, index, x, y) => setCtxMenu({ type, index, x, y })}
        />

        {chartOpen && (
          <div className="w-80 border-l border-border flex-shrink-0 overflow-y-auto bg-bg-raised">
            <ChartPanel charts={charts} selection={selection} onChartsChange={onChartsChange} />
          </div>
        )}

        {pythonOpen && (
          <div className="w-96 border-l border-border flex-shrink-0 bg-bg-raised">
            <PythonPanel />
          </div>
        )}
      </div>

      {/* Sheet tabs */}
      <div className="flex items-center border-t border-border bg-bg-surface px-2 h-8 gap-1 shrink-0">
        {sheetNames.map(name => (
          <button
            key={name}
            onClick={() => onSheetSwitch(name)}
            className={`text-xs px-3 py-0.5 rounded border font-medium transition-colors ${
              name === activeSheet
                ? 'bg-bg-raised border-border text-fg-primary shadow-sm'
                : 'border-transparent text-fg-tertiary hover:text-fg-primary hover:bg-bg-raised hover:border-border'
            }`}
          >
            {name}
          </button>
        ))}
        <button onClick={handleAddSheet} className="text-xs px-2 py-0.5 text-fg-tertiary hover:text-fg-secondary transition-colors">
          + Add sheet
        </button>
      </div>

      <StatusBar selected={selected} selectionEnd={selectionEnd} />
    </div>
  )
}
