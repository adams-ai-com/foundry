'use client'

import { useCallback, useEffect, useState } from 'react'
import { colIndexToLetter } from '@foundry/shared'
import type { CellAddress } from '@foundry/shared'
import { useHyperFormulaContext } from '@/lib/hyperformula-context'
import { applyNumFormat } from '@/lib/format-utils'
import { ROWS, COLS, COL_WIDTH, ROW_HEIGHT, HEADER_WIDTH } from '@/lib/sheet-constants'

function inRange(row: number, col: number, start: CellAddress, end: CellAddress | null): boolean {
  if (!end) return false
  const minRow = Math.min(start.row, end.row), maxRow = Math.max(start.row, end.row)
  const minCol = Math.min(start.col, end.col), maxCol = Math.max(start.col, end.col)
  return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
}

function getCellAtPoint(x: number, y: number): { row: number; col: number } | null {
  const el = document.elementFromPoint(x, y)
  if (!el) return null
  const cell = el.closest('[data-testid^="cell-"]')
  if (!cell) return null
  const m = cell.getAttribute('data-testid')?.match(/^cell-(\d+)-(\d+)$/)
  return m ? { row: parseInt(m[1]), col: parseInt(m[2]) } : null
}

function computeFillValue(
  formula: string | null,
  value: string | number | boolean | null,
  delta: number,
): string {
  if (typeof value === 'number' && !formula) return String(value + delta)
  if (formula) return formula
  return String(value ?? '')
}

// Jump to the boundary of the data region in one axis direction
function ctrlMove(current: number, dir: 1 | -1, max: number, getVal: (i: number) => unknown): number {
  const next = current + dir
  if (next < 0 || next >= max) return current
  const curEmpty = (v: unknown) => v === null || v === '' || v === undefined
  if (!curEmpty(getVal(current)) && !curEmpty(getVal(next))) {
    let i = next
    for (;;) {
      const after = i + dir
      if (after < 0 || after >= max || curEmpty(getVal(after))) return i
      i = after
    }
  } else {
    let i = next
    while (i >= 0 && i < max) {
      if (!curEmpty(getVal(i))) return i
      i += dir
    }
    return Math.max(0, Math.min(max - 1, i - dir))
  }
}

interface GridProps {
  selected: CellAddress
  selectionEnd: CellAddress | null
  onSelect: (addr: CellAddress) => void
  onSelectionEnd: (addr: CellAddress | null) => void
  findMatches?: { row: number; col: number }[]
  findMatchIndex?: number
  frozenRows?: number
  frozenCols?: number
  onContextMenu?: (type: 'row' | 'col', index: number, x: number, y: number) => void
}

export function Grid({
  selected, selectionEnd, onSelect, onSelectionEnd,
  findMatches, findMatchIndex,
  frozenRows = 0, frozenCols = 0,
  onContextMenu,
}: GridProps) {
  const { getCellValue, setCellValue, getCellFormula, getCellFormat, setRangeFormat, undo, redo, bulkSetCells } = useHyperFormulaContext()
  const [colWidths, setColWidths] = useState<number[]>(() => Array(COLS).fill(COL_WIDTH))
  const [rowHeights, setRowHeights] = useState<number[]>(() => Array(ROWS).fill(ROW_HEIGHT))
  const [fillEnd, setFillEnd] = useState<{ row: number; col: number } | null>(null)

  const commitValue = useCallback((addr: CellAddress, value: string) => {
    setCellValue(addr, value)
  }, [setCellValue])

  function startColResize(e: React.MouseEvent, col: number) {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX, startW = colWidths[col]
    const onMove = (me: MouseEvent) => {
      setColWidths(prev => { const next = [...prev]; next[col] = Math.max(40, startW + me.clientX - startX); return next })
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function startRowResize(e: React.MouseEvent, row: number) {
    e.preventDefault(); e.stopPropagation()
    const startY = e.clientY, startH = rowHeights[row]
    const onMove = (me: MouseEvent) => {
      setRowHeights(prev => { const next = [...prev]; next[row] = Math.max(16, startH + me.clientY - startY); return next })
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function startFillDrag(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    const onMove = (me: MouseEvent) => {
      const cell = getCellAtPoint(me.clientX, me.clientY)
      if (cell) setFillEnd(cell)
    }
    const onUp = (me: MouseEvent) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const cell = getCellAtPoint(me.clientX, me.clientY)
      if (cell) applyFill(cell)
      setFillEnd(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function applyFill(end: { row: number; col: number }) {
    const { row: sr, col: sc } = selected
    const dRow = end.row - sr, dCol = end.col - sc
    if (dRow === 0 && dCol === 0) return
    const rawValue = getCellValue(selected)
    const formula = getCellFormula(selected)

    if (Math.abs(dRow) >= Math.abs(dCol)) {
      const dir = (dRow > 0 ? 1 : -1) as 1 | -1
      const count = Math.abs(dRow)
      const minRow = dir === 1 ? sr + 1 : end.row
      const values = Array.from({ length: count }, (_, i) => {
        const step = dir === 1 ? i + 1 : count - i
        return [computeFillValue(formula, rawValue, step * dir)]
      })
      bulkSetCells({ ...selected, row: minRow }, values)
    } else {
      const dir = (dCol > 0 ? 1 : -1) as 1 | -1
      const count = Math.abs(dCol)
      const minCol = dir === 1 ? sc + 1 : end.col
      const values = [[...Array.from({ length: count }, (_, i) => {
        const step = dir === 1 ? i + 1 : count - i
        return computeFillValue(formula, rawValue, step * dir)
      })]]
      bulkSetCells({ ...selected, col: minCol }, values)
    }
  }

  useEffect(() => {
    const inCellInput = () =>
      document.activeElement?.tagName === 'INPUT' &&
      (document.activeElement as HTMLInputElement).classList.contains('cell-input')

    const inExternalInput = () => {
      const el = document.activeElement
      if (!el || el.tagName !== 'INPUT') return false
      return !(el as HTMLInputElement).classList.contains('cell-input')
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (inExternalInput()) return
      const ctrl = e.ctrlKey || e.metaKey
      const { row, col } = selected

      if (ctrl) {
        switch (e.key.toLowerCase()) {
          case 'z': e.preventDefault(); undo(); return
          case 'y': e.preventDefault(); redo(); return
        }

        // Ctrl+Arrow: jump to data region boundary
        if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault()
          let newRow = row, newCol = col
          const val = (r: number, c: number) => getCellValue({ sheet: selected.sheet, row: r, col: c })
          if (e.key === 'ArrowDown')  newRow = ctrlMove(row, 1, ROWS, r => val(r, col))
          if (e.key === 'ArrowUp')    newRow = ctrlMove(row, -1, ROWS, r => val(r, col))
          if (e.key === 'ArrowRight') newCol = ctrlMove(col, 1, COLS, c => val(row, c))
          if (e.key === 'ArrowLeft')  newCol = ctrlMove(col, -1, COLS, c => val(row, c))
          const newAddr: CellAddress = { ...selected, row: newRow, col: newCol }
          if (e.shiftKey) { onSelectionEnd(newAddr) } else { onSelect(newAddr); onSelectionEnd(null) }
          return
        }

        if (!inCellInput()) {
          switch (e.key.toLowerCase()) {
            case 'b': e.preventDefault(); setRangeFormat(selected, selectionEnd, { bold: !getCellFormat(selected).bold }); return
            case 'i': e.preventDefault(); setRangeFormat(selected, selectionEnd, { italic: !getCellFormat(selected).italic }); return
            case 'u': e.preventDefault(); setRangeFormat(selected, selectionEnd, { underline: !getCellFormat(selected).underline }); return
            case 'a':
              e.preventDefault()
              onSelect({ ...selected, row: 0, col: 0 })
              onSelectionEnd({ ...selected, row: ROWS - 1, col: COLS - 1 })
              return
            case 'c': {
              e.preventDefault()
              const end = selectionEnd ?? selected
              const minRow = Math.min(selected.row, end.row), maxRow = Math.max(selected.row, end.row)
              const minCol = Math.min(selected.col, end.col), maxCol = Math.max(selected.col, end.col)
              const lines: string[] = []
              for (let r = minRow; r <= maxRow; r++) {
                const cells: string[] = []
                for (let c = minCol; c <= maxCol; c++) {
                  const addr: CellAddress = { sheet: selected.sheet, row: r, col: c }
                  cells.push(getCellFormula(addr) ?? String(getCellValue(addr) ?? ''))
                }
                lines.push(cells.join('\t'))
              }
              navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
              return
            }
          }
        }
        return
      }

      if (inCellInput()) {
        if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      }

      const extend = e.shiftKey
      let newRow = row, newCol = col, moved = false
      if (e.key === 'ArrowDown')  { newRow = Math.min(row + 1, ROWS - 1); moved = true }
      else if (e.key === 'ArrowUp')    { newRow = Math.max(row - 1, 0); moved = true }
      else if (e.key === 'ArrowRight') { newCol = Math.min(col + 1, COLS - 1); moved = true }
      else if (e.key === 'ArrowLeft')  { newCol = Math.max(col - 1, 0); moved = true }
      else if (e.key === 'Home')       { newCol = 0; moved = true }
      else if (e.key === 'Delete' || e.key === 'Backspace') { commitValue(selected, ''); return }

      if (!moved) return
      e.preventDefault()
      const newAddr: CellAddress = { ...selected, row: newRow, col: newCol }
      if (extend) { onSelectionEnd(newAddr) } else { onSelect(newAddr); onSelectionEnd(null) }
    }

    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as Element | null
      if (!target) return
      if (target.tagName === 'INPUT' && !(target as HTMLElement).classList.contains('cell-input')) return
      const text = e.clipboardData?.getData('text/plain')
      if (!text) return
      e.preventDefault()
      bulkSetCells(selected, text.split('\n').map(line => line.split('\t')))
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('paste', onPaste)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('paste', onPaste) }
  }, [selected, selectionEnd, onSelect, onSelectionEnd, commitValue, getCellFormat, getCellFormula, getCellValue, setRangeFormat, undo, redo, bulkSetCells])

  // Fill preview cells during drag
  const fillPreviewCells = new Set<string>()
  if (fillEnd) {
    const dRow = fillEnd.row - selected.row, dCol = fillEnd.col - selected.col
    if (Math.abs(dRow) >= Math.abs(dCol)) {
      const dir = dRow > 0 ? 1 : -1
      for (let r = selected.row + dir; r !== fillEnd.row + dir; r += dir) fillPreviewCells.add(`${r}:${selected.col}`)
    } else {
      const dir = dCol > 0 ? 1 : -1
      for (let c = selected.col + dir; c !== fillEnd.col + dir; c += dir) fillPreviewCells.add(`${selected.row}:${c}`)
    }
  }

  const activeMatchKey = (findMatches && findMatchIndex !== undefined && findMatches[findMatchIndex])
    ? `${findMatches[findMatchIndex].row}:${findMatches[findMatchIndex].col}` : null
  const findMatchSet = new Set(findMatches?.map(m => `${m.row}:${m.col}`) ?? [])

  const totalWidth = HEADER_WIDTH + colWidths.reduce((sum, w) => sum + w, 0)

  // Cumulative frozen row heights for sticky top offsets
  const frozenRowOffsets: number[] = []
  let frozenTop = ROW_HEIGHT // start below col headers
  for (let r = 0; r < frozenRows; r++) {
    frozenRowOffsets[r] = frozenTop
    frozenTop += rowHeights[r]
  }

  return (
    <div className="flex-1 overflow-auto focus:outline-none" tabIndex={0}>
      <div style={{ width: totalWidth, position: 'relative' }}>
        {/* Corner */}
        <div
          className="cell header sticky top-0 left-0 z-20"
          style={{ width: HEADER_WIDTH, height: ROW_HEIGHT }}
        />

        {/* Column headers */}
        <div className="flex sticky top-0 z-10" style={{ marginLeft: HEADER_WIDTH }}>
          {Array.from({ length: COLS }, (_, col) => (
            <div
              key={col}
              className={`cell header border-l relative ${selected.col === col ? 'header-active' : ''}`}
              style={{ width: colWidths[col], minWidth: colWidths[col] }}
              onContextMenu={e => { e.preventDefault(); onContextMenu?.('col', col, e.clientX, e.clientY) }}
            >
              {colIndexToLetter(col)}
              <div
                className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize z-10 hover:bg-accent/30"
                onMouseDown={e => startColResize(e, col)}
              />
            </div>
          ))}
        </div>

        {/* Rows */}
        {Array.from({ length: ROWS }, (_, row) => {
          const isFrozenRow = row < frozenRows
          const rowStyle: React.CSSProperties = {
            ...(isFrozenRow ? { position: 'sticky', top: frozenRowOffsets[row], zIndex: 8 } : {}),
          }

          return (
            <div key={row} className="flex" style={rowStyle}>
              {/* Row header */}
              <div
                className={`cell header border-t sticky left-0 z-10 relative ${selected.row === row ? 'header-active' : ''}`}
                style={{ width: HEADER_WIDTH, minWidth: HEADER_WIDTH, height: rowHeights[row], lineHeight: `${rowHeights[row]}px` }}
                onContextMenu={e => { e.preventDefault(); onContextMenu?.('row', row, e.clientX, e.clientY) }}
              >
                {row + 1}
                {/* Row resize handle */}
                <div
                  className="absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize hover:bg-accent/30 z-10"
                  onMouseDown={e => startRowResize(e, row)}
                />
              </div>

              {/* Cells */}
              {Array.from({ length: COLS }, (_, col) => {
                const addr: CellAddress = { sheet: selected.sheet, row, col }
                const isSelected = selected.row === row && selected.col === col
                const isInRange = inRange(row, col, selected, selectionEnd)
                const rawValue = getCellValue(addr)
                const fmt = getCellFormat(addr)
                const displayValue = applyNumFormat(rawValue, fmt.numFormat)
                const fontClasses = [
                  fmt.bold         ? 'font-bold'    : '',
                  fmt.italic       ? 'italic'       : '',
                  fmt.underline    ? 'underline'    : '',
                  fmt.strikethrough ? 'line-through' : '',
                ].filter(Boolean).join(' ')
                const textAlign = fmt.align ?? (typeof rawValue === 'number' ? 'right' : 'left')
                const cellKey = `${row}:${col}`
                const isFindMatch = !isSelected && findMatchSet.has(cellKey)
                const isFindActive = !isSelected && cellKey === activeMatchKey
                const isFillPreview = !isSelected && fillPreviewCells.has(cellKey)
                const appliedFill = (isSelected || isInRange || isFindMatch || isFindActive || isFillPreview)
                  ? undefined : fmt.fillColor

                const isFrozenCol = col < frozenCols
                const cellStyle: React.CSSProperties = {
                  width: colWidths[col], minWidth: colWidths[col],
                  textAlign,
                  height: rowHeights[row],
                  lineHeight: `${rowHeights[row]}px`,
                  color: fmt.color,
                  backgroundColor: appliedFill,
                  ...(isFrozenCol ? { position: 'sticky', left: HEADER_WIDTH, zIndex: isFrozenRow ? 11 : 9 } : {}),
                }

                return (
                  <div
                    key={col}
                    data-testid={`cell-${row}-${col}`}
                    className={[
                      'cell border-t border-l relative',
                      isSelected ? 'selected' : isInRange ? 'in-range' : '',
                      isFindActive ? 'find-match-active' : isFindMatch ? 'find-match' : '',
                      isFillPreview ? 'fill-preview' : '',
                      fontClasses,
                    ].filter(Boolean).join(' ')}
                    style={cellStyle}
                    onMouseDown={e => {
                      if (e.shiftKey) { onSelectionEnd(addr) }
                      else { onSelect(addr); onSelectionEnd(null) }
                    }}
                    onDoubleClick={() => document.getElementById(`cell-${row}-${col}`)?.focus()}
                  >
                    {isSelected ? (
                      <>
                        <input
                          autoFocus
                          onFocus={e => e.currentTarget.select()}
                          id={`cell-${row}-${col}`}
                          className={`cell-input absolute inset-0 w-full h-full px-1.5 text-sm bg-transparent outline-none ${fontClasses}`}
                          style={{ textAlign, color: fmt.color }}
                          defaultValue={getCellFormula(addr) ?? String(rawValue ?? '')}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              commitValue(addr, e.currentTarget.value)
                              onSelect({ ...addr, row: row + 1 })
                              onSelectionEnd(null)
                              e.preventDefault()
                            }
                            if (e.key === 'Tab') {
                              commitValue(addr, e.currentTarget.value)
                              onSelect(col + 1 >= COLS ? { ...addr, row: row + 1, col: 0 } : { ...addr, col: col + 1 })
                              onSelectionEnd(null)
                              e.preventDefault()
                            }
                            if (e.key === 'Escape') {
                              e.currentTarget.value = displayValue
                              e.currentTarget.blur()
                            }
                          }}
                          onBlur={e => commitValue(addr, e.target.value)}
                        />
                        {/* Auto-fill handle */}
                        <div
                          className="absolute bottom-0 right-0 w-2 h-2 bg-accent border border-bg-base cursor-crosshair z-20"
                          style={{ transform: 'translate(50%, 50%)' }}
                          onMouseDown={startFillDrag}
                        />
                      </>
                    ) : (
                      displayValue
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
