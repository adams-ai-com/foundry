'use client'

import { useState } from 'react'
import { colIndexToLetter } from '@foundry/shared'
import { useHyperFormulaContext } from '@/lib/hyperformula-context'
import { BarChartSVG, LineChartSVG, PieChartSVG } from './ChartRenderer'
import type { ChartData } from './ChartRenderer'
import type { ChartDef } from '@/lib/actions'
import type { CellAddress } from '@foundry/shared'

interface Props {
  charts: ChartDef[]
  selection: { start: CellAddress; end: CellAddress } | null
  onChartsChange: (charts: ChartDef[]) => void
}

function cellLabel(row: number, col: number): string {
  return `${colIndexToLetter(col)}${row + 1}`
}

function rangeLabel(start: CellAddress, end: CellAddress): string {
  const s = cellLabel(start.row, start.col)
  const e = cellLabel(end.row, end.col)
  return s === e ? s : `${s}:${e}`
}

function parseRangeAddr(s: string): { row: number; col: number } | null {
  const m = s.trim().match(/^([A-Z]+)(\d+)$/)
  if (!m) return null
  let col = 0
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64)
  return { row: parseInt(m[2]) - 1, col: col - 1 }
}

function extractChartData(
  chart: ChartDef,
  getCellValue: (addr: CellAddress) => string | number | boolean | null,
): ChartData {
  const [startStr, endStr] = chart.range.split(':')
  const s = parseRangeAddr(startStr)
  const e = endStr ? parseRangeAddr(endStr) : s
  if (!s || !e) return { labels: [], series: [] }

  const minR = Math.min(s.row, e.row)
  const maxR = Math.max(s.row, e.row)
  const minC = Math.min(s.col, e.col)
  const maxC = Math.max(s.col, e.col)

  let dataR = minR
  let dataC = minC
  const seriesNames: string[] = []
  const labels: string[] = []

  if (chart.firstRowHeader) {
    for (let c = minC + (chart.firstColLabel ? 1 : 0); c <= maxC; c++) {
      const v = getCellValue({ sheet: chart.sheet, row: minR, col: c })
      seriesNames.push(String(v ?? `S${c - minC + 1}`))
    }
    dataR = minR + 1
  }

  if (chart.firstColLabel) {
    for (let r = dataR; r <= maxR; r++) {
      const v = getCellValue({ sheet: chart.sheet, row: r, col: minC })
      labels.push(String(v ?? `R${r - dataR + 1}`))
    }
    dataC = minC + 1
  } else {
    for (let r = dataR; r <= maxR; r++) labels.push(`R${r - dataR + 1}`)
  }

  const series: { name: string; values: number[] }[] = []
  for (let c = dataC; c <= maxC; c++) {
    const values: number[] = []
    for (let r = dataR; r <= maxR; r++) {
      const v = getCellValue({ sheet: chart.sheet, row: r, col: c })
      values.push(typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0)
    }
    const si = c - dataC
    series.push({ name: seriesNames[si] ?? `S${si + 1}`, values })
  }

  return { labels, series }
}

export function ChartPanel({ charts, selection, onChartsChange }: Props) {
  const { getCellValue } = useHyperFormulaContext()
  const [chartType, setChartType] = useState<ChartDef['type']>('bar')
  const [chartTitle, setChartTitle] = useState('')
  const [firstRowHeader, setFirstRowHeader] = useState(true)
  const [firstColLabel, setFirstColLabel] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)

  function insertChart() {
    if (!selection) return
    const newChart: ChartDef = {
      id: crypto.randomUUID(),
      type: chartType,
      title: chartTitle.trim() || `Chart ${charts.length + 1}`,
      sheet: selection.start.sheet,
      range: rangeLabel(selection.start, selection.end),
      firstRowHeader,
      firstColLabel,
    }
    const updated = [...charts, newChart]
    onChartsChange(updated)
    setActiveId(newChart.id)
    setChartTitle('')
  }

  function removeChart(id: string) {
    const updated = charts.filter(c => c.id !== id)
    onChartsChange(updated)
    if (activeId === id) setActiveId(updated[0]?.id ?? null)
  }

  const active = charts.find(c => c.id === activeId) ?? charts[0] ?? null

  const W = 296, H = 220

  return (
    <div data-testid="chart-panel" className="h-full flex flex-col bg-white">
      {/* Creation form */}
      <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50 shrink-0">
        <p className="text-xs font-semibold text-gray-600 mb-2">Charts</p>

        {selection ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Range: <span className="font-mono text-gray-700">{rangeLabel(selection.start, selection.end)}</span>
            </p>
            <div className="flex gap-1">
              {(['bar', 'line', 'pie'] as const).map(t => (
                <button key={t} onClick={() => setChartType(t)}
                  className={`flex-1 text-xs py-1 rounded border transition-colors ${chartType === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {t}
                </button>
              ))}
            </div>
            <input value={chartTitle} onChange={e => setChartTitle(e.target.value)}
              placeholder="Chart title…"
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <div className="flex gap-3">
              <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={firstRowHeader} onChange={e => setFirstRowHeader(e.target.checked)} className="w-3 h-3" />
                Header row
              </label>
              <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={firstColLabel} onChange={e => setFirstColLabel(e.target.checked)} className="w-3 h-3" />
                Label col
              </label>
            </div>
            <button onClick={insertChart}
              className="w-full text-xs bg-blue-600 text-white py-1.5 rounded hover:bg-blue-700 font-medium transition-colors">
              Insert chart
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Shift+click to select a range, then insert a chart.</p>
        )}
      </div>

      {/* Chart list */}
      {charts.length > 0 && (
        <div className="border-b border-gray-100 shrink-0">
          {charts.map(c => (
            <div key={c.id} onClick={() => setActiveId(c.id)}
              className={`flex items-center justify-between px-3 py-2 cursor-pointer text-xs ${active?.id === c.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 opacity-60">
                  {c.type === 'bar' ? '▊' : c.type === 'line' ? '∿' : '◔'}
                </span>
                <span className="truncate">{c.title}</span>
              </div>
              <button onClick={e => { e.stopPropagation(); removeChart(c.id) }}
                className="text-gray-300 hover:text-red-400 ml-2 shrink-0">×</button>
            </div>
          ))}
        </div>
      )}

      {/* Chart render */}
      {active && (
        <div className="flex-1 overflow-hidden p-2 flex flex-col">
          <p className="text-xs font-medium text-gray-600 text-center mb-1 truncate">{active.title}</p>
          {(() => {
            const data = extractChartData(active, getCellValue)
            if (active.type === 'bar') return <BarChartSVG data={data} width={W} height={H} />
            if (active.type === 'line') return <LineChartSVG data={data} width={W} height={H} />
            return <PieChartSVG data={data} width={W} height={H} />
          })()}
        </div>
      )}

      {charts.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-gray-400 text-center px-4 leading-relaxed">
            No charts yet.<br />Select a range, then click Insert chart.
          </p>
        </div>
      )}
    </div>
  )
}
