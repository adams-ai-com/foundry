'use client'

import { useCallback, useEffect } from 'react'
import { cellAddress, colIndexToLetter } from '@foundry/shared'
import type { CellAddress } from '@foundry/shared'
import { useHyperFormulaContext } from '@/lib/hyperformula-context'

const ROWS = 100
const COLS = 26
const COL_WIDTH = 100
const ROW_HEIGHT = 24
const HEADER_WIDTH = 50

interface GridProps {
  selected: CellAddress
  onSelect: (addr: CellAddress) => void
}

export function Grid({ selected, onSelect }: GridProps) {
  const { getCellValue, setCellValue, getCellFormula } = useHyperFormulaContext()

  const commitValue = useCallback((addr: CellAddress, value: string) => {
    setCellValue(addr, value)
  }, [setCellValue])

  useEffect(() => {
    let editValue = ''
    let editing = false

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't capture if an input is already focused (the cell input handles its own keys)
      if (document.activeElement?.tagName === 'INPUT' && document.activeElement.classList.contains('cell-input')) return

      const { row, col } = selected
      if (e.key === 'ArrowDown')  { e.preventDefault(); onSelect({ ...selected, row: Math.min(row + 1, ROWS - 1) }) }
      if (e.key === 'ArrowUp')    { e.preventDefault(); onSelect({ ...selected, row: Math.max(row - 1, 0) }) }
      if (e.key === 'ArrowRight') { e.preventDefault(); onSelect({ ...selected, col: Math.min(col + 1, COLS - 1) }) }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); onSelect({ ...selected, col: Math.max(col - 1, 0) }) }
      if (e.key === 'Delete' || e.key === 'Backspace') commitValue(selected, '')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected, onSelect, commitValue])

  return (
    <div className="flex-1 overflow-auto focus:outline-none" tabIndex={0}>
      <div style={{ width: HEADER_WIDTH + COLS * COL_WIDTH, position: 'relative' }}>
        {/* Corner */}
        <div className="cell header sticky top-0 left-0 z-20 bg-gray-50" style={{ width: HEADER_WIDTH, height: ROW_HEIGHT }} />

        {/* Column headers */}
        <div className="flex sticky top-0 z-10" style={{ marginLeft: HEADER_WIDTH }}>
          {Array.from({ length: COLS }, (_, col) => (
            <div
              key={col}
              className={`cell header border-l ${selected.col === col ? 'bg-blue-50 text-blue-700' : ''}`}
              style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}
            >
              {colIndexToLetter(col)}
            </div>
          ))}
        </div>

        {/* Rows */}
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} className="flex">
            <div
              className={`cell header border-t sticky left-0 z-10 ${selected.row === row ? 'bg-blue-50 text-blue-700' : ''}`}
              style={{ width: HEADER_WIDTH, minWidth: HEADER_WIDTH }}
            >
              {row + 1}
            </div>
            {Array.from({ length: COLS }, (_, col) => {
              const addr: CellAddress = { sheet: selected.sheet, row, col }
              const isSelected = selected.row === row && selected.col === col
              const displayValue = String(getCellValue(addr) ?? '')

              return (
                <div
                  key={col}
                  className={`cell border-t border-l relative ${isSelected ? 'selected' : ''}`}
                  style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}
                  onMouseDown={() => onSelect(addr)}
                  onDoubleClick={() => {
                    const el = document.getElementById(`cell-${row}-${col}`)
                    el?.focus()
                  }}
                >
                  {isSelected ? (
                    <input
                      id={`cell-${row}-${col}`}
                      className="cell-input absolute inset-0 w-full h-full px-1.5 text-sm bg-transparent outline-none"
                      defaultValue={getCellFormula(addr) ?? displayValue}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitValue(addr, e.currentTarget.value)
                          onSelect({ ...addr, row: row + 1 })
                          e.preventDefault()
                        }
                        if (e.key === 'Tab') {
                          commitValue(addr, e.currentTarget.value)
                          onSelect({ ...addr, col: col + 1 })
                          e.preventDefault()
                        }
                        if (e.key === 'Escape') {
                          e.currentTarget.value = displayValue
                          e.currentTarget.blur()
                        }
                      }}
                      onBlur={(e) => commitValue(addr, e.target.value)}
                    />
                  ) : (
                    displayValue
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
