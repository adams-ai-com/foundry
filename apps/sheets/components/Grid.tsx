'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cellAddress, colIndexToLetter } from '@foundry/shared'
import type { CellAddress, CellData } from '@foundry/shared'
import { useHyperFormula } from '@/lib/hyperformula'

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
  const containerRef = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const { getCellValue, setCellValue, getCellFormula } = useHyperFormula()

  const startEdit = useCallback(
    (addr: CellAddress) => {
      const formula = getCellFormula(addr)
      const value = getCellValue(addr)
      setEditValue(formula ?? String(value ?? ''))
      setEditing(true)
    },
    [getCellFormula, getCellValue]
  )

  const commitEdit = useCallback(() => {
    if (editing) {
      setCellValue(selected, editValue)
      setEditing(false)
    }
  }, [editing, editValue, selected, setCellValue])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editing) {
        if (e.key === 'Escape') setEditing(false)
        if (e.key === 'Enter') {
          commitEdit()
          onSelect({ ...selected, row: selected.row + 1 })
        }
        if (e.key === 'Tab') {
          e.preventDefault()
          commitEdit()
          onSelect({ ...selected, col: selected.col + 1 })
        }
        return
      }

      const { row, col } = selected
      if (e.key === 'ArrowDown') { e.preventDefault(); onSelect({ ...selected, row: Math.min(row + 1, ROWS - 1) }) }
      if (e.key === 'ArrowUp') { e.preventDefault(); onSelect({ ...selected, row: Math.max(row - 1, 0) }) }
      if (e.key === 'ArrowRight') { e.preventDefault(); onSelect({ ...selected, col: Math.min(col + 1, COLS - 1) }) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); onSelect({ ...selected, col: Math.max(col - 1, 0) }) }
      if (e.key === 'Enter' || e.key === 'F2') startEdit(selected)
      if (e.key === 'Delete' || e.key === 'Backspace') setCellValue(selected, '')
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        setEditValue(e.key)
        setEditing(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editing, selected, onSelect, startEdit, commitEdit, setCellValue])

  return (
    <div ref={containerRef} className="flex-1 overflow-auto focus:outline-none" tabIndex={0}>
      <div style={{ width: HEADER_WIDTH + COLS * COL_WIDTH, position: 'relative' }}>
        {/* Corner */}
        <div
          className="cell header sticky top-0 left-0 z-20 bg-gray-50"
          style={{ width: HEADER_WIDTH, height: ROW_HEIGHT, position: 'sticky' }}
        />
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
            {/* Row header */}
            <div
              className={`cell header border-t sticky left-0 z-10 ${selected.row === row ? 'bg-blue-50 text-blue-700' : ''}`}
              style={{ width: HEADER_WIDTH, minWidth: HEADER_WIDTH }}
            >
              {row + 1}
            </div>
            {/* Cells */}
            {Array.from({ length: COLS }, (_, col) => {
              const addr: CellAddress = { sheet: selected.sheet, row, col }
              const isSelected = selected.row === row && selected.col === col
              const isEditing = isSelected && editing
              const displayValue = isEditing ? editValue : String(getCellValue(addr) ?? '')

              return (
                <div
                  key={col}
                  className={`cell border-t border-l relative ${isSelected ? 'selected' : ''}`}
                  style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}
                  onMouseDown={() => { commitEdit(); onSelect(addr) }}
                  onDoubleClick={() => startEdit(addr)}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      className="absolute inset-0 w-full h-full px-1.5 text-sm border-2 border-blue-500 bg-white outline-none z-10"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
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
