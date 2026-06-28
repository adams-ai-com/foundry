'use client'

import { colIndexToLetter } from '@owl/shared'
import type { CellAddress } from '@owl/shared'
import { useHyperFormulaContext } from '@/lib/hyperformula-context'

interface FormulaBarProps {
  selected: CellAddress
  selectionEnd: CellAddress | null
}

function cellAddr(row: number, col: number): string {
  return `${colIndexToLetter(col)}${row + 1}`
}

function rangeAddr(start: CellAddress, end: CellAddress | null): string {
  const s = cellAddr(start.row, start.col)
  if (!end) return s
  const e = cellAddr(end.row, end.col)
  return s === e ? s : `${s}:${e}`
}

export function FormulaBar({ selected, selectionEnd }: FormulaBarProps) {
  const { getCellFormula, getCellValue, setCellValue } = useHyperFormulaContext()
  const formula = getCellFormula(selected)
  const value = getCellValue(selected)
  const original = formula ?? String(value ?? '')

  function commit(newValue: string) {
    if (newValue !== original) {
      setCellValue(selected, newValue)
    }
  }

  return (
    <div className="flex items-center border-b border-border bg-bg-raised h-8 text-sm shrink-0">
      <div
        data-testid="formula-address"
        className="px-2 border-r border-border text-fg-tertiary font-mono text-xs w-24 text-center flex-shrink-0"
      >
        {rangeAddr(selected, selectionEnd)}
      </div>
      <div className="flex items-center px-2 gap-1.5 flex-1 min-w-0">
        {formula && <span className="text-accent font-mono text-xs shrink-0">fx</span>}
        <input
          key={`${selected.sheet}-${selected.row}-${selected.col}`}
          data-testid="formula-value"
          className="flex-1 font-mono text-xs text-fg-primary bg-transparent outline-none min-w-0"
          defaultValue={original}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { commit(e.currentTarget.value); e.currentTarget.blur() }
            if (e.key === 'Escape') { e.currentTarget.value = original; e.currentTarget.blur() }
          }}
          onBlur={(e) => commit(e.currentTarget.value)}
        />
      </div>
    </div>
  )
}
