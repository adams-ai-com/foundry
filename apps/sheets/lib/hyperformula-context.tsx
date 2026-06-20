'use client'

import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useHyperFormula } from './hyperformula'
import type { SheetData, CellFormat, CellFormats } from './actions'
import type { CellAddress } from '@foundry/shared'

type HFContextValue = ReturnType<typeof useHyperFormula> & {
  getCellFormat: (addr: CellAddress) => CellFormat
  setCellFormat: (addr: CellAddress, patch: Partial<CellFormat>) => void
  setRangeFormat: (start: CellAddress, end: CellAddress | null, patch: Partial<CellFormat>) => void
  loadAll: (data: SheetData, formats?: CellFormats) => void
  addRow: (sheetName: string, rowIndex: number) => void
  deleteRow: (sheetName: string, rowIndex: number) => void
  addColumn: (sheetName: string, colIndex: number) => void
  deleteColumn: (sheetName: string, colIndex: number) => void
  sortColumn: (sheetName: string, colIndex: number, ascending: boolean) => void
  renameSheetWithFormats: (oldName: string, newName: string) => void
  deleteSheetWithFormats: (sheetName: string) => void
}

const HyperFormulaContext = createContext<HFContextValue | null>(null)

export function HyperFormulaProvider({
  initialData,
  initialFormats,
  onChange,
  onFormatsChange,
  children,
}: {
  initialData?: SheetData
  initialFormats?: CellFormats
  onChange?: (data: SheetData) => void
  onFormatsChange?: (formats: CellFormats) => void
  children: React.ReactNode
}) {
  const hf = useHyperFormula(initialData, onChange)

  const formatsRef = useRef<CellFormats>(initialFormats ?? {})
  const [formatTick, setFormatTick] = useState(0)
  const onFormatsChangeRef = useRef(onFormatsChange)
  onFormatsChangeRef.current = onFormatsChange

  const getCellFormat = useCallback((addr: CellAddress): CellFormat => {
    return formatsRef.current[addr.sheet]?.[`${addr.row}:${addr.col}`] ?? {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatTick])

  const setCellFormat = useCallback((addr: CellAddress, patch: Partial<CellFormat>) => {
    const key = `${addr.row}:${addr.col}`
    const sheetFmts = formatsRef.current[addr.sheet] ?? {}
    formatsRef.current = {
      ...formatsRef.current,
      [addr.sheet]: { ...sheetFmts, [key]: { ...(sheetFmts[key] ?? {}), ...patch } },
    }
    setFormatTick(t => t + 1)
    onFormatsChangeRef.current?.(formatsRef.current)
  }, [])

  const setRangeFormat = useCallback((start: CellAddress, end: CellAddress | null, patch: Partial<CellFormat>) => {
    if (!end || (start.row === end.row && start.col === end.col)) {
      const key = `${start.row}:${start.col}`
      const sheetFmts = formatsRef.current[start.sheet] ?? {}
      formatsRef.current = {
        ...formatsRef.current,
        [start.sheet]: { ...sheetFmts, [key]: { ...(sheetFmts[key] ?? {}), ...patch } },
      }
    } else {
      const minRow = Math.min(start.row, end.row)
      const maxRow = Math.max(start.row, end.row)
      const minCol = Math.min(start.col, end.col)
      const maxCol = Math.max(start.col, end.col)
      const sheetFmts = { ...(formatsRef.current[start.sheet] ?? {}) }
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const key = `${r}:${c}`
          sheetFmts[key] = { ...(sheetFmts[key] ?? {}), ...patch }
        }
      }
      formatsRef.current = { ...formatsRef.current, [start.sheet]: sheetFmts }
    }
    setFormatTick(t => t + 1)
    onFormatsChangeRef.current?.(formatsRef.current)
  }, [])

  const loadAll = useCallback((data: SheetData, formats: CellFormats = {}) => {
    hf.loadSheets(data)
    formatsRef.current = formats
    setFormatTick(t => t + 1)
    onFormatsChangeRef.current?.(formats)
  }, [hf])

  // Shift format keys when rows/cols are inserted or deleted
  function shiftFormats(sheetName: string, axis: 'row' | 'col', index: number, delta: number) {
    const fmts = { ...(formatsRef.current[sheetName] ?? {}) }
    const shifted: Record<string, CellFormat> = {}
    for (const [key, fmt] of Object.entries(fmts)) {
      const [r, c] = key.split(':').map(Number)
      const idx = axis === 'row' ? r : c
      if (delta > 0) {
        // insert: shift indices >= index up by delta
        if (idx < index) shifted[key] = fmt
        else shifted[axis === 'row' ? `${r + delta}:${c}` : `${r}:${c + delta}`] = fmt
      } else {
        // delete: discard deleted index; shift above it down
        if (idx < index) shifted[key] = fmt
        else if (idx === index) { /* drop */ }
        else shifted[axis === 'row' ? `${r + delta}:${c}` : `${r}:${c + delta}`] = fmt
      }
    }
    formatsRef.current = { ...formatsRef.current, [sheetName]: shifted }
    setFormatTick(t => t + 1)
    onFormatsChangeRef.current?.(formatsRef.current)
  }

  const addRow = useCallback((sheetName: string, rowIndex: number) => {
    shiftFormats(sheetName, 'row', rowIndex, 1)
    hf.addRows(sheetName, rowIndex, 1)
  }, [hf]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteRow = useCallback((sheetName: string, rowIndex: number) => {
    shiftFormats(sheetName, 'row', rowIndex, -1)
    hf.removeRows(sheetName, rowIndex, 1)
  }, [hf]) // eslint-disable-line react-hooks/exhaustive-deps

  const addColumn = useCallback((sheetName: string, colIndex: number) => {
    shiftFormats(sheetName, 'col', colIndex, 1)
    hf.addColumns(sheetName, colIndex, 1)
  }, [hf]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteColumn = useCallback((sheetName: string, colIndex: number) => {
    shiftFormats(sheetName, 'col', colIndex, -1)
    hf.removeColumns(sheetName, colIndex, 1)
  }, [hf]) // eslint-disable-line react-hooks/exhaustive-deps

  const sortColumn = useCallback((sheetName: string, colIndex: number, ascending: boolean) => {
    const data = hf.getSerializedData()
    const rows = (data[sheetName] ?? []) as (string | number | null)[][]
    if (rows.length === 0) return

    // Compute sort keys from displayed (computed) values
    const withKeys = rows.map((row, i) => ({
      row,
      key: hf.getCellValue({ sheet: sheetName, row: i, col: colIndex }),
    }))
    withKeys.sort((a, b) => {
      const av = a.key ?? '', bv = b.key ?? ''
      if (typeof av === 'number' && typeof bv === 'number') return ascending ? av - bv : bv - av
      return ascending ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })

    // Rearrange formats to follow rows
    const sheetFmts = formatsRef.current[sheetName] ?? {}
    const maxCols = Math.max(...rows.map(r => r.length), 1)
    const newFmts: Record<string, CellFormat> = {}
    withKeys.forEach(({ row: origRow }, newRow) => {
      const origIdx = rows.indexOf(origRow)
      for (let c = 0; c < maxCols; c++) {
        const orig = sheetFmts[`${origIdx}:${c}`]
        if (orig) newFmts[`${newRow}:${c}`] = orig
      }
    })
    formatsRef.current = { ...formatsRef.current, [sheetName]: newFmts }
    setFormatTick(t => t + 1)
    onFormatsChangeRef.current?.(formatsRef.current)

    hf.bulkSetCells({ sheet: sheetName, row: 0, col: 0 }, withKeys.map(({ row }) => row))
  }, [hf]) // eslint-disable-line react-hooks/exhaustive-deps

  const renameSheetWithFormats = useCallback((oldName: string, newName: string) => {
    const fmts = formatsRef.current
    if (fmts[oldName]) {
      const { [oldName]: old, ...rest } = fmts
      formatsRef.current = { ...rest, [newName]: old }
      setFormatTick(t => t + 1)
      onFormatsChangeRef.current?.(formatsRef.current)
    }
    hf.renameSheet(oldName, newName)
  }, [hf]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteSheetWithFormats = useCallback((sheetName: string) => {
    const { [sheetName]: _, ...rest } = formatsRef.current
    formatsRef.current = rest
    setFormatTick(t => t + 1)
    onFormatsChangeRef.current?.(formatsRef.current)
    hf.removeSheet(sheetName)
  }, [hf]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <HyperFormulaContext.Provider value={{ ...hf, getCellFormat, setCellFormat, setRangeFormat, loadAll, addRow, deleteRow, addColumn, deleteColumn, sortColumn, renameSheetWithFormats, deleteSheetWithFormats }}>
      {children}
    </HyperFormulaContext.Provider>
  )
}

export function useHyperFormulaContext(): HFContextValue {
  const ctx = useContext(HyperFormulaContext)
  if (!ctx) throw new Error('useHyperFormulaContext must be inside HyperFormulaProvider')
  return ctx
}
