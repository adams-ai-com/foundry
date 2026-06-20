'use client'

import { useHyperFormulaContext } from '@/lib/hyperformula-context'
import type { CellAddress } from '@foundry/shared'

interface StatusBarProps {
  selected: CellAddress
  selectionEnd: CellAddress | null
}

export function StatusBar({ selected, selectionEnd }: StatusBarProps) {
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

  if (!hasRange && count === 0) {
    return <div className="h-6 border-t border-border bg-bg-surface shrink-0" />
  }

  const sum = numbers.reduce((a, b) => a + b, 0)
  const avg = numbers.length > 0 ? sum / numbers.length : null

  return (
    <div className="flex items-center gap-5 px-4 h-6 border-t border-border bg-bg-surface shrink-0">
      {count > 0 && (
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
  )
}
