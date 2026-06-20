'use client'

import { useCallback, useEffect, useState } from 'react'
import { colIndexToLetter } from '@foundry/shared'
import type { CellAddress } from '@foundry/shared'
import { useHyperFormulaContext } from '@/lib/hyperformula-context'
import { applyNumFormat } from '@/lib/format-utils'
import { ROWS, COLS, COL_WIDTH, ROW_HEIGHT, HEADER_WIDTH } from '@/lib/sheet-constants'
import type { MergedRange } from '@/lib/actions'

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

function computeFillValue(formula: string | null, value: string | number | boolean | null, delta: number): string {
  if (typeof value === 'number' && !formula) return String(value + delta)
  if (formula) return formula
  return String(value ?? '')
}

function ctrlMove(current: number, dir: 1 | -1, max: number, getVal: (i: number) => unknown): number {
  const next = current + dir
  if (next < 0 || next >= max) return current
  const empty = (v: unknown) => v === null || v === '' || v === undefined
  if (!empty(getVal(current)) && !empty(getVal(next))) {
    let i = next
    for (;;) {
      const after = i + dir
      if (after < 0 || after >= max || empty(getVal(after))) return i
      i = after
    }
  } else {
    let i = next
    while (i >= 0 && i < max) { if (!empty(getVal(i))) return i; i += dir }
    return Math.max(0, Math.min(max - 1, i - dir))
  }
}

function isUrl(s: string) { return /^https?:\/\//i.test(s) }

interface GridProps {
  selected: CellAddress
  selectionEnd: CellAddress | null
  onSelect: (addr: CellAddress) => void
  onSelectionEnd: (addr: CellAddress | null) => void
  findMatches?: { row: number; col: number }[]
  findMatchIndex?: number
  frozenRows?: number
  frozenCols?: number
  zoom?: number
  merges?: MergedRange[]
  onContextMenu?: (type: 'row' | 'col', index: number, x: number, y: number) => void
}

export function Grid({
  selected, selectionEnd, onSelect, onSelectionEnd,
  findMatches, findMatchIndex,
  frozenRows = 0, frozenCols = 0,
  zoom = 100,
  merges = [],
  onContextMenu,
}: GridProps) {
  const { getCellValue, setCellValue, getCellFormula, getCellFormat, setRangeFormat, undo, redo, bulkSetCells } = useHyperFormulaContext()
  const [colWidths, setColWidths] = useState<number[]>(() => Array(COLS).fill(COL_WIDTH))
  const [rowHeights, setRowHeights] = useState<number[]>(() => Array(ROWS).fill(ROW_HEIGHT))
  const [fillEnd, setFillEnd] = useState<{ row: number; col: number } | null>(null)

  const commitValue = useCallback((addr: CellAddress, value: string) => {
    setCellValue(addr, value)
  }, [setCellValue])

  // Prefix sums for absolute positioning of merges and overlays
  const colPrefix = [0]
  for (let i = 0; i < COLS; i++) colPrefix.push(colPrefix[i] + colWidths[i])
  const rowPrefix = [0]
  for (let i = 0; i < ROWS; i++) rowPrefix.push(rowPrefix[i] + rowHeights[i])

  // Merge lookup maps for current sheet
  const sheetMerges = merges.filter(m => m.sheet === selected.sheet)
  const mergeAnchorMap = new Map<string, MergedRange>()  // "row:col" → merge
  const mergeCoveredMap = new Map<string, MergedRange>()
  for (const m of sheetMerges) {
    mergeAnchorMap.set(`${m.startRow}:${m.startCol}`, m)
    for (let r = m.startRow; r <= m.endRow; r++) {
      for (let c = m.startCol; c <= m.endCol; c++) {
        if (r !== m.startRow || c !== m.startCol) mergeCoveredMap.set(`${r}:${c}`, m)
      }
    }
  }

  function startColResize(e: React.MouseEvent, col: number) {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX, startW = colWidths[col]
    const onMove = (me: MouseEvent) => setColWidths(prev => { const n = [...prev]; n[col] = Math.max(40, startW + me.clientX - startX); return n })
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  function startRowResize(e: React.MouseEvent, row: number) {
    e.preventDefault(); e.stopPropagation()
    const startY = e.clientY, startH = rowHeights[row]
    const onMove = (me: MouseEvent) => setRowHeights(prev => { const n = [...prev]; n[row] = Math.max(16, startH + me.clientY - startY); return n })
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  function startFillDrag(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    const onMove = (me: MouseEvent) => { const c = getCellAtPoint(me.clientX, me.clientY); if (c) setFillEnd(c) }
    const onUp = (me: MouseEvent) => {
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
      const c = getCellAtPoint(me.clientX, me.clientY); if (c) applyFill(c)
      setFillEnd(null)
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  function applyFill(end: { row: number; col: number }) {
    const { row: sr, col: sc } = selected
    const dRow = end.row - sr, dCol = end.col - sc
    if (dRow === 0 && dCol === 0) return
    const rawValue = getCellValue(selected), formula = getCellFormula(selected)
    if (Math.abs(dRow) >= Math.abs(dCol)) {
      const dir = (dRow > 0 ? 1 : -1) as 1 | -1, count = Math.abs(dRow)
      const minRow = dir === 1 ? sr + 1 : end.row
      bulkSetCells({ ...selected, row: minRow }, Array.from({ length: count }, (_, i) => [computeFillValue(formula, rawValue, (dir === 1 ? i + 1 : count - i) * dir)]))
    } else {
      const dir = (dCol > 0 ? 1 : -1) as 1 | -1, count = Math.abs(dCol)
      const minCol = dir === 1 ? sc + 1 : end.col
      bulkSetCells({ ...selected, col: minCol }, [[...Array.from({ length: count }, (_, i) => computeFillValue(formula, rawValue, (dir === 1 ? i + 1 : count - i) * dir))]])
    }
  }

  useEffect(() => {
    const inCellInput = () => document.activeElement?.tagName === 'INPUT' && (document.activeElement as HTMLInputElement).classList.contains('cell-input')
    const inExternalInput = () => { const el = document.activeElement; if (!el || el.tagName !== 'INPUT') return false; return !(el as HTMLInputElement).classList.contains('cell-input') }

    const onKeyDown = (e: KeyboardEvent) => {
      if (inExternalInput()) return
      const ctrl = e.ctrlKey || e.metaKey
      const { row, col } = selected

      if (ctrl) {
        switch (e.key.toLowerCase()) {
          case 'z': e.preventDefault(); undo(); return
          case 'y': e.preventDefault(); redo(); return
        }
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
              const lines: string[] = []
              for (let r = Math.min(selected.row, end.row); r <= Math.max(selected.row, end.row); r++) {
                const cells: string[] = []
                for (let c = Math.min(selected.col, end.col); c <= Math.max(selected.col, end.col); c++) {
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

      if (inCellInput() && !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return

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
      if (!target || (target.tagName === 'INPUT' && !(target as HTMLElement).classList.contains('cell-input'))) return
      const text = e.clipboardData?.getData('text/plain')
      if (!text) return
      e.preventDefault()
      bulkSetCells(selected, text.split('\n').map(line => line.split('\t')))
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('paste', onPaste)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('paste', onPaste) }
  }, [selected, selectionEnd, onSelect, onSelectionEnd, commitValue, getCellFormat, getCellFormula, getCellValue, setRangeFormat, undo, redo, bulkSetCells])

  // Fill preview
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

  const activeMatchKey = (findMatches && findMatchIndex !== undefined && findMatches[findMatchIndex]) ? `${findMatches[findMatchIndex].row}:${findMatches[findMatchIndex].col}` : null
  const findMatchSet = new Set(findMatches?.map(m => `${m.row}:${m.col}`) ?? [])
  const totalWidth = HEADER_WIDTH + colPrefix[COLS]

  // Frozen row sticky offsets
  const frozenRowOffsets: number[] = []
  let frozenTop = ROW_HEIGHT
  for (let r = 0; r < frozenRows; r++) { frozenRowOffsets[r] = frozenTop; frozenTop += rowHeights[r] }

  function renderCell(row: number, col: number, opts: { asOverlay?: boolean; overrideWidth?: number; overrideHeight?: number } = {}) {
    const addr: CellAddress = { sheet: selected.sheet, row, col }
    const cellKey = `${row}:${col}`
    const isSelected = selected.row === row && selected.col === col
    const isInRange = inRange(row, col, selected, selectionEnd)
    const rawValue = getCellValue(addr)
    const fmt = getCellFormat(addr)
    const displayValue = applyNumFormat(rawValue, fmt.numFormat)
    const fontClasses = [
      fmt.bold          ? 'font-bold'    : '',
      fmt.italic        ? 'italic'       : '',
      fmt.underline     ? 'underline'    : '',
      fmt.strikethrough ? 'line-through' : '',
    ].filter(Boolean).join(' ')
    const textAlign = fmt.align ?? (typeof rawValue === 'number' ? 'right' : 'left')
    const isFindMatch = !isSelected && findMatchSet.has(cellKey)
    const isFindActive = !isSelected && cellKey === activeMatchKey
    const isFillPreview = !isSelected && fillPreviewCells.has(cellKey)
    const appliedFill = (isSelected || isInRange || isFindMatch || isFindActive || isFillPreview) ? undefined : fmt.fillColor

    const w = opts.overrideWidth ?? colWidths[col]
    const h = opts.overrideHeight ?? rowHeights[row]

    const borderStyle: React.CSSProperties = {}
    if (fmt.borders?.top)    borderStyle.borderTop    = `1.5px solid ${fmt.borders.top}`
    if (fmt.borders?.right)  borderStyle.borderRight  = `1.5px solid ${fmt.borders.right}`
    if (fmt.borders?.bottom) borderStyle.borderBottom = `1.5px solid ${fmt.borders.bottom}`
    if (fmt.borders?.left)   borderStyle.borderLeft   = `1.5px solid ${fmt.borders.left}`

    const cellStyle: React.CSSProperties = {
      width: w, minWidth: w,
      textAlign,
      ...(fmt.wrapText ? { minHeight: h } : { height: h, lineHeight: `${h}px` }),
      color: fmt.color,
      backgroundColor: appliedFill,
      fontSize: fmt.fontSize ? `${fmt.fontSize}px` : undefined,
      ...borderStyle,
      ...(opts.asOverlay ? { position: 'absolute', zIndex: 6 } : {}),
    }

    const displayContent = isUrl(String(displayValue)) ? (
      <a
        href={String(displayValue)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent underline"
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {displayValue}
      </a>
    ) : displayValue

    return (
      <div
        key={opts.asOverlay ? `overlay-${row}-${col}` : col}
        data-testid={`cell-${row}-${col}`}
        className={[
          'cell border-t border-l relative',
          fmt.wrapText ? 'wrap-text' : '',
          isSelected ? 'selected' : isInRange ? 'in-range' : '',
          isFindActive ? 'find-match-active' : isFindMatch ? 'find-match' : '',
          isFillPreview ? 'fill-preview' : '',
          fontClasses,
        ].filter(Boolean).join(' ')}
        style={cellStyle}
        onMouseDown={e => {
          // Ctrl+click on URL opens it
          if ((e.ctrlKey || e.metaKey) && isUrl(String(displayValue))) {
            window.open(String(displayValue), '_blank')
            return
          }
          if (e.shiftKey) { onSelectionEnd(addr) } else { onSelect(addr); onSelectionEnd(null) }
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
              style={{ textAlign, color: fmt.color, fontSize: fmt.fontSize ? `${fmt.fontSize}px` : undefined }}
              defaultValue={getCellFormula(addr) ?? String(rawValue ?? '')}
              onKeyDown={e => {
                if (e.key === 'Enter') { commitValue(addr, e.currentTarget.value); onSelect({ ...addr, row: row + 1 }); onSelectionEnd(null); e.preventDefault() }
                if (e.key === 'Tab') { commitValue(addr, e.currentTarget.value); onSelect(col + 1 >= COLS ? { ...addr, row: row + 1, col: 0 } : { ...addr, col: col + 1 }); onSelectionEnd(null); e.preventDefault() }
                if (e.key === 'Escape') { e.currentTarget.value = displayValue; e.currentTarget.blur() }
              }}
              onBlur={e => commitValue(addr, e.target.value)}
            />
            <div
              className="absolute bottom-0 right-0 w-2 h-2 bg-accent border border-bg-base cursor-crosshair z-20"
              style={{ transform: 'translate(50%, 50%)' }}
              onMouseDown={startFillDrag}
            />
          </>
        ) : displayContent}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto focus:outline-none" tabIndex={0}>
      <div style={{ width: totalWidth, position: 'relative', zoom: zoom !== 100 ? zoom / 100 : undefined }}>
        {/* Corner */}
        <div className="cell header sticky top-0 left-0 z-20" style={{ width: HEADER_WIDTH, height: ROW_HEIGHT }} />

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
              <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize z-10 hover:bg-accent/30" onMouseDown={e => startColResize(e, col)} />
            </div>
          ))}
        </div>

        {/* Rows */}
        {Array.from({ length: ROWS }, (_, row) => {
          const isFrozenRow = row < frozenRows
          return (
            <div key={row} className="flex" style={isFrozenRow ? { position: 'sticky', top: frozenRowOffsets[row], zIndex: 8 } : undefined}>
              {/* Row header */}
              <div
                className={`cell header border-t sticky left-0 z-10 relative ${selected.row === row ? 'header-active' : ''}`}
                style={{ width: HEADER_WIDTH, minWidth: HEADER_WIDTH, minHeight: rowHeights[row] }}
                onContextMenu={e => { e.preventDefault(); onContextMenu?.('row', row, e.clientX, e.clientY) }}
              >
                {row + 1}
                <div className="absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize hover:bg-accent/30 z-10" onMouseDown={e => startRowResize(e, row)} />
              </div>

              {/* Cells */}
              {Array.from({ length: COLS }, (_, col) => {
                const cellKey = `${row}:${col}`
                const isFrozenCol = col < frozenCols
                const isCovered = mergeCoveredMap.has(cellKey)

                if (isCovered) {
                  // Invisible placeholder so layout stays correct; overlay renders on top
                  return (
                    <div
                      key={col}
                      style={{ width: colWidths[col], minWidth: colWidths[col], height: rowHeights[row], visibility: 'hidden', pointerEvents: 'none' }}
                    />
                  )
                }

                const isMergeAnchor = mergeAnchorMap.has(cellKey)
                if (isMergeAnchor) {
                  // Anchor renders as absolute overlay; placeholder here keeps layout
                  return (
                    <div
                      key={col}
                      style={{ width: colWidths[col], minWidth: colWidths[col], height: rowHeights[row], visibility: 'hidden', pointerEvents: 'none' }}
                    />
                  )
                }

                const baseCell = renderCell(row, col)
                if (!isFrozenCol) return baseCell

                // Frozen column: wrap with sticky left style
                return (
                  <div
                    key={col}
                    style={{ position: 'sticky', left: HEADER_WIDTH, zIndex: isFrozenRow ? 11 : 9, width: colWidths[col], minWidth: colWidths[col] }}
                  >
                    {/* re-render with no width override (handled by wrapper) */}
                    {renderCell(row, col)}
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Merge cell overlays — absolutely positioned on top of hidden placeholders */}
        {sheetMerges.map(m => {
          const left = HEADER_WIDTH + colPrefix[m.startCol]
          const top = ROW_HEIGHT + rowPrefix[m.startRow]
          const width = colPrefix[m.endCol + 1] - colPrefix[m.startCol]
          const height = rowPrefix[m.endRow + 1] - rowPrefix[m.startRow]
          return (
            <div key={`${m.startRow}:${m.startCol}`} style={{ position: 'absolute', left, top, width, height, zIndex: 6 }}>
              {renderCell(m.startRow, m.startCol, { overrideWidth: width, overrideHeight: height })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
