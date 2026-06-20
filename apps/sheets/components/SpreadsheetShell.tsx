'use client'

import { useEffect, useRef, useState } from 'react'
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
import type { SheetData, CellFormats, ChartDef, MergedRange } from '@/lib/actions'
import { ROWS, COLS } from '@/lib/sheet-constants'

interface SpreadsheetShellProps {
  initialData?: SheetData
  initialFormats?: CellFormats
  initialCharts?: ChartDef[]
  initialMerges?: MergedRange[]
  onChange?: (data: SheetData) => void
  onFormatsChange?: (formats: CellFormats) => void
  onChartsChange?: (charts: ChartDef[]) => void
  onMergesChange?: (merges: MergedRange[]) => void
}

export function SpreadsheetShell({
  initialData,
  initialFormats,
  initialCharts,
  initialMerges,
  onChange,
  onFormatsChange,
  onChartsChange,
  onMergesChange,
}: SpreadsheetShellProps) {
  const firstSheet = Object.keys(initialData ?? {})[0] ?? 'Sheet1'
  const [activeSheet, setActiveSheet] = useState(firstSheet)
  const [selected, setSelected] = useState<CellAddress>({ sheet: firstSheet, row: 0, col: 0 })
  const [selectionEnd, setSelectionEnd] = useState<CellAddress | null>(null)
  const [pythonOpen, setPythonOpen] = useState(false)
  const [chartOpen, setChartOpen] = useState(false)
  const [charts, setCharts] = useState<ChartDef[]>(initialCharts ?? [])
  const [merges, setMerges] = useState<MergedRange[]>(initialMerges ?? [])

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

  function handleMergesChange(updated: MergedRange[]) {
    setMerges(updated)
    onMergesChange?.(updated)
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
        merges={merges}
        selection={selection}
        onSelect={handleSelect}
        onSelectionEnd={setSelectionEnd}
        onSheetSwitch={handleSheetSwitch}
        onTogglePython={() => { setPythonOpen(v => !v); setChartOpen(false) }}
        onToggleChart={() => { setChartOpen(v => !v); setPythonOpen(false) }}
        onChartsChange={handleChartsChange}
        onMergesChange={handleMergesChange}
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
  merges: MergedRange[]
  selection: { start: CellAddress; end: CellAddress } | null
  onSelect: (addr: CellAddress) => void
  onSelectionEnd: (addr: CellAddress | null) => void
  onSheetSwitch: (name: string) => void
  onTogglePython: () => void
  onToggleChart: () => void
  onChartsChange: (charts: ChartDef[]) => void
  onMergesChange: (merges: MergedRange[]) => void
}

function SheetContent({
  activeSheet,
  selected,
  selectionEnd,
  pythonOpen,
  chartOpen,
  charts,
  merges,
  selection,
  onSelect,
  onSelectionEnd,
  onSheetSwitch,
  onTogglePython,
  onToggleChart,
  onChartsChange,
  onMergesChange,
}: SheetContentProps) {
  const {
    getSheetNames, addSheet, getCellValue, getCellFormula, setCellValue,
    addRow, deleteRow, addColumn, deleteColumn, sortColumn,
    renameSheetWithFormats, deleteSheetWithFormats, bulkSetCells,
  } = useHyperFormulaContext()

  // Freeze panes
  const [frozenRows, setFrozenRows] = useState(0)
  const [frozenCols, setFrozenCols] = useState(0)

  // Zoom
  const [zoom, setZoom] = useState(100)

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ type: 'row' | 'col'; index: number; x: number; y: number } | null>(null)

  // Find & Replace
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [findMatches, setFindMatches] = useState<{ row: number; col: number }[]>([])
  const [findMatchIndex, setFindMatchIndex] = useState(0)

  // Sheet rename
  const [renamingSheet, setRenamingSheet] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingSheet && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingSheet])

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

  function commitRename() {
    if (!renamingSheet) return
    const newName = renameValue.trim()
    if (newName && newName !== renamingSheet) {
      renameSheetWithFormats(renamingSheet, newName)
      // Update merges that referenced old sheet name
      const updated = merges.map(m => m.sheet === renamingSheet ? { ...m, sheet: newName } : m)
      onMergesChange(updated)
      if (activeSheet === renamingSheet) onSheetSwitch(newName)
    }
    setRenamingSheet(null)
  }

  function handleDeleteSheet(name: string) {
    const names = getSheetNames()
    if (names.length <= 1) return // don't delete last sheet
    // Remove merges from deleted sheet
    const updated = merges.filter(m => m.sheet !== name)
    onMergesChange(updated)
    deleteSheetWithFormats(name)
    if (activeSheet === name) {
      const remaining = names.filter(n => n !== name)
      onSheetSwitch(remaining[0] ?? 'Sheet1')
    }
  }

  function handleToggleMerge() {
    const end = selectionEnd ?? selected
    const minRow = Math.min(selected.row, end.row)
    const maxRow = Math.max(selected.row, end.row)
    const minCol = Math.min(selected.col, end.col)
    const maxCol = Math.max(selected.col, end.col)
    const sheet = selected.sheet

    // Check if selected cell is part of a merge
    const existingMerge = merges.find(m =>
      m.sheet === sheet &&
      selected.row >= m.startRow && selected.row <= m.endRow &&
      selected.col >= m.startCol && selected.col <= m.endCol
    )

    if (existingMerge) {
      // Unmerge
      const updated = merges.filter(m => m !== existingMerge)
      onMergesChange(updated)
      return
    }

    if (minRow === maxRow && minCol === maxCol) return // single cell, nothing to merge

    // Keep anchor value; clear covered cells
    const rows: string[][] = []
    for (let r = minRow; r <= maxRow; r++) {
      const row: string[] = []
      for (let c = minCol; c <= maxCol; c++) {
        row.push(r === minRow && c === minCol
          ? (getCellFormula({ sheet, row: r, col: c }) ?? String(getCellValue({ sheet, row: r, col: c }) ?? ''))
          : '')
      }
      rows.push(row)
    }
    bulkSetCells({ sheet, row: minRow, col: minCol }, rows)

    const updated = [
      ...merges.filter(m => !(m.sheet === sheet && m.startRow === minRow && m.startCol === minCol && m.endRow === maxRow && m.endCol === maxCol)),
      { sheet, startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol },
    ]
    onMergesChange(updated)
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
        merges={merges}
        onToggleMerge={handleToggleMerge}
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
          zoom={zoom}
          merges={merges}
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
      <div className="flex items-center border-t border-border bg-bg-surface px-2 h-8 gap-0.5 shrink-0 overflow-x-auto">
        {sheetNames.map(name => (
          <div
            key={name}
            className={`flex items-center gap-0.5 group shrink-0 ${
              name === activeSheet ? 'bg-bg-raised border border-border rounded shadow-sm' : ''
            }`}
          >
            {renamingSheet === name ? (
              <input
                ref={renameInputRef}
                className="text-xs px-2 py-0.5 w-24 bg-transparent outline-none border-b border-accent text-fg-primary"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setRenamingSheet(null)
                  e.stopPropagation()
                }}
              />
            ) : (
              <button
                className={`text-xs px-2.5 py-0.5 font-medium transition-colors ${
                  name === activeSheet ? 'text-fg-primary' : 'text-fg-tertiary hover:text-fg-primary'
                }`}
                onClick={() => onSheetSwitch(name)}
                onDoubleClick={() => {
                  setRenamingSheet(name)
                  setRenameValue(name)
                }}
              >
                {name}
              </button>
            )}
            {sheetNames.length > 1 && (
              <button
                className="w-3.5 h-3.5 flex items-center justify-center text-fg-tertiary opacity-0 group-hover:opacity-100 hover:text-fg-primary hover:bg-bg-hover rounded transition-all text-xs leading-none"
                onClick={e => { e.stopPropagation(); handleDeleteSheet(name) }}
                title={`Delete ${name}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button onClick={handleAddSheet} className="text-xs px-2 py-0.5 text-fg-tertiary hover:text-fg-secondary transition-colors shrink-0">
          + Add sheet
        </button>
      </div>

      <StatusBar
        selected={selected}
        selectionEnd={selectionEnd}
        zoom={zoom}
        onZoomChange={setZoom}
      />
    </div>
  )
}
