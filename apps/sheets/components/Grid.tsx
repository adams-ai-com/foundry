'use client'

import { useCallback, useEffect } from 'react'
import { colIndexToLetter } from '@foundry/shared'
import type { CellAddress } from '@foundry/shared'
import { useHyperFormulaContext } from '@/lib/hyperformula-context'
import { applyNumFormat } from '@/lib/format-utils'

const ROWS = 100
const COLS = 26
const COL_WIDTH = 100
const ROW_HEIGHT = 24
const HEADER_WIDTH = 50

function inRange(
  row: number, col: number,
  start: CellAddress, end: CellAddress | null,
): boolean {
  if (!end) return false
  const minRow = Math.min(start.row, end.row)
  const maxRow = Math.max(start.row, end.row)
  const minCol = Math.min(start.col, end.col)
  const maxCol = Math.max(start.col, end.col)
  return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
}

interface GridProps {
  selected: CellAddress
  selectionEnd: CellAddress | null
  onSelect: (addr: CellAddress) => void
  onSelectionEnd: (addr: CellAddress | null) => void
}

export function Grid({ selected, selectionEnd, onSelect, onSelectionEnd }: GridProps) {
  const { getCellValue, setCellValue, getCellFormula, getCellFormat } = useHyperFormulaContext()

  const commitValue = useCallback((addr: CellAddress, value: string) => {
    setCellValue(addr, value)
  }, [setCellValue])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' && document.activeElement.classList.contains('cell-input')) {
        if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      }

      const { row, col } = selected
      const extend = e.shiftKey

      let newRow = row, newCol = col, moved = false
      if (e.key === 'ArrowDown')  { newRow = Math.min(row + 1, ROWS - 1); moved = true }
      else if (e.key === 'ArrowUp')    { newRow = Math.max(row - 1, 0); moved = true }
      else if (e.key === 'ArrowRight') { newCol = Math.min(col + 1, COLS - 1); moved = true }
      else if (e.key === 'ArrowLeft')  { newCol = Math.max(col - 1, 0); moved = true }
      else if (e.key === 'Delete' || e.key === 'Backspace') { commitValue(selected, ''); return }

      if (!moved) return
      e.preventDefault()

      const newAddr: CellAddress = { ...selected, row: newRow, col: newCol }
      if (extend) {
        onSelectionEnd(newAddr)
      } else {
        onSelect(newAddr)
        onSelectionEnd(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected, onSelect, onSelectionEnd, commitValue])

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
              const isInRange = inRange(row, col, selected, selectionEnd)
              const rawValue = getCellValue(addr)
              const fmt = getCellFormat(addr)
              const displayValue = applyNumFormat(rawValue, fmt.numFormat)
              const fontClasses = [
                fmt.bold      ? 'font-bold'  : '',
                fmt.italic    ? 'italic'     : '',
                fmt.underline ? 'underline'  : '',
              ].filter(Boolean).join(' ')

              return (
                <div
                  key={col}
                  data-testid={`cell-${row}-${col}`}
                  className={`cell border-t border-l relative ${isSelected ? 'selected' : isInRange ? 'bg-blue-50' : ''} ${fontClasses}`}
                  style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}
                  onMouseDown={(e) => {
                    if (e.shiftKey) {
                      onSelectionEnd(addr)
                    } else {
                      onSelect(addr)
                      onSelectionEnd(null)
                    }
                  }}
                  onDoubleClick={() => {
                    document.getElementById(`cell-${row}-${col}`)?.focus()
                  }}
                >
                  {isSelected ? (
                    <input
                      autoFocus
                      onFocus={(e) => { e.currentTarget.select() }}
                      id={`cell-${row}-${col}`}
                      className={`cell-input absolute inset-0 w-full h-full px-1.5 text-sm bg-transparent outline-none ${fontClasses}`}
                      defaultValue={getCellFormula(addr) ?? String(rawValue ?? '')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitValue(addr, e.currentTarget.value)
                          onSelect({ ...addr, row: row + 1 })
                          onSelectionEnd(null)
                          e.preventDefault()
                        }
                        if (e.key === 'Tab') {
                          commitValue(addr, e.currentTarget.value)
                          onSelect({ ...addr, col: col + 1 })
                          onSelectionEnd(null)
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
