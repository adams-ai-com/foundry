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

  return (
    <HyperFormulaContext.Provider value={{ ...hf, getCellFormat, setCellFormat, setRangeFormat, loadAll }}>
      {children}
    </HyperFormulaContext.Provider>
  )
}

export function useHyperFormulaContext(): HFContextValue {
  const ctx = useContext(HyperFormulaContext)
  if (!ctx) throw new Error('useHyperFormulaContext must be inside HyperFormulaProvider')
  return ctx
}
