'use client'

import { cellAddress } from '@foundry/shared'
import type { CellAddress } from '@foundry/shared'
import { useHyperFormulaContext } from '@/lib/hyperformula-context'

interface FormulaBarProps {
  selected: CellAddress
}

export function FormulaBar({ selected }: FormulaBarProps) {
  const { getCellFormula, getCellValue } = useHyperFormulaContext()
  const formula = getCellFormula(selected)
  const value = getCellValue(selected)
  const display = formula ?? String(value ?? '')

  return (
    <div className="flex items-center border-b border-gray-200 bg-white h-8 text-sm">
      <div data-testid="formula-address" className="px-2 border-r border-gray-200 text-gray-500 font-mono text-xs w-16 text-center flex-shrink-0">
        {cellAddress(selected.row, selected.col)}
      </div>
      <div className="flex items-center px-2 gap-1 flex-1">
        {formula && <span className="text-gray-400 font-mono text-xs">fx</span>}
        <span data-testid="formula-value" className="font-mono text-xs text-gray-700 truncate">{display}</span>
      </div>
    </div>
  )
}
