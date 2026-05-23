'use client'

import { useState } from 'react'
import { Grid } from './Grid'
import { FormulaBar } from './FormulaBar'
import { Toolbar } from './Toolbar'
import { PythonPanel } from './PythonPanel'
import { ChartPanel } from './ChartPanel'
import { HyperFormulaProvider, useHyperFormulaContext } from '@/lib/hyperformula-context'
import type { CellAddress } from '@foundry/shared'
import type { SheetData, CellFormats, ChartDef } from '@/lib/actions'

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
  const { getSheetNames, addSheet } = useHyperFormulaContext()

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
      />
      <FormulaBar selected={selected} selectionEnd={selectionEnd} />

      <div className="flex flex-1 overflow-hidden">
        <Grid
          selected={selected}
          selectionEnd={selectionEnd}
          onSelect={onSelect}
          onSelectionEnd={onSelectionEnd}
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
                : 'border-transparent text-fg-secondary hover:text-fg-primary hover:bg-bg-raised hover:border-border'
            }`}
          >
            {name}
          </button>
        ))}
        <button onClick={handleAddSheet} className="text-xs px-2 py-0.5 text-fg-tertiary hover:text-fg-secondary transition-colors">
          + Add sheet
        </button>
      </div>
    </div>
  )
}
