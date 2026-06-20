'use client'

import { useHyperFormulaContext } from '@/lib/hyperformula-context'
import type { CellAddress } from '@foundry/shared'

interface StatusBarProps {
  selected: CellAddress
  selectionEnd: CellAddress | null
  zoom: number
  onZoomChange: (zoom: number) => void
}

const ZOOM_STEPS = [50, 75, 90, 100, 110, 125, 150, 175, 200]

export function StatusBar({ selected, selectionEnd, zoom, onZoomChange }: StatusBarProps) {
  const { getCellValue } = useHyperFormulaContext()

  const end = selectionEnd ?? selected
  const hasRange = selectionEnd && (selected.row !== end.row || selected.col !== end.col)
  const minRow = Math.min(selected.row, end.row)
  const maxRow = Math.max(selected.row, end.row)
  const minCol = Math.min(selected.col, end.col)
  const maxCol = Math.max(selected.col, end.col)

  const numbers: number[] = []
  let count = 0

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const val = getCellValue({ sheet: selected.sheet, row: r, col: c })
      if (val !== null && val !== '' && val !== undefined) {
        count++
        if (typeof val === 'number') numbers.push(val)
      }
    }
  }

  const sum = numbers.reduce((a, b) => a + b, 0)
  const avg = numbers.length > 0 ? sum / numbers.length : null

  function stepZoom(dir: 1 | -1) {
    const sorted = [...ZOOM_STEPS].sort((a, b) => a - b)
    if (dir === 1) {
      const next = sorted.find(s => s > zoom)
      if (next) onZoomChange(next)
    } else {
      const next = [...sorted].reverse().find(s => s < zoom)
      if (next) onZoomChange(next)
    }
  }

  return (
    <div className="flex items-center px-4 h-6 border-t border-border bg-bg-surface shrink-0">
      <div className="flex items-center gap-5 flex-1">
        {(hasRange || count > 0) && count > 0 && (
          <span className="text-xs text-fg-tertiary">
            Count: <span className="text-fg-secondary tabular-nums">{count}</span>
          </span>
        )}
        {numbers.length > 1 && (
          <>
            <span className="text-xs text-fg-tertiary">
              Sum: <span className="text-fg-secondary tabular-nums">{sum.toLocaleString()}</span>
            </span>
            <span className="text-xs text-fg-tertiary">
              Average: <span className="text-fg-secondary tabular-nums">{avg!.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            </span>
          </>
        )}
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={() => stepZoom(-1)}
          className="w-4 h-4 flex items-center justify-center text-fg-tertiary hover:text-fg-primary text-xs leading-none rounded hover:bg-bg-hover transition-colors"
          title="Zoom out"
        >
          −
        </button>
        <select
          value={zoom}
          onChange={e => onZoomChange(Number(e.target.value))}
          className="text-xs text-fg-secondary bg-transparent border-0 outline-none cursor-pointer hover:text-fg-primary tabular-nums w-14 text-center"
          title="Zoom level"
        >
          {ZOOM_STEPS.map(s => (
            <option key={s} value={s}>{s}%</option>
          ))}
        </select>
        <button
          onClick={() => stepZoom(1)}
          className="w-4 h-4 flex items-center justify-center text-fg-tertiary hover:text-fg-primary text-xs leading-none rounded hover:bg-bg-hover transition-colors"
          title="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  )
}
