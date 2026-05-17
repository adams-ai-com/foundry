import { useCallback, useEffect, useRef, useState } from 'react'
import type { CellAddress } from '@foundry/shared'
import type { SheetData } from './actions'

export function useHyperFormula(initialData?: SheetData) {
  const [tick, setTick] = useState(0)
  const hfRef = useRef<import('hyperformula').HyperFormula | null>(null)

  useEffect(() => {
    let cancelled = false
    import('hyperformula').then(({ HyperFormula }) => {
      if (cancelled) return
      const sheets = initialData && Object.keys(initialData).length > 0
        ? initialData
        : { Sheet1: [] }
      hfRef.current = HyperFormula.buildFromSheets(sheets, { licenseKey: 'gpl-v3' })
      setTick(t => t + 1)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getCellValue = useCallback((addr: CellAddress): string | number | boolean | null => {
    if (!hfRef.current) return null
    try {
      const sheetId = hfRef.current.getSheetId(addr.sheet)
      if (sheetId === undefined) return null
      const val = hfRef.current.getCellValue({ sheet: sheetId, row: addr.row, col: addr.col })
      if (val instanceof Error) return `#ERR`
      return val as string | number | boolean | null
    } catch { return null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const getCellFormula = useCallback((addr: CellAddress): string | null => {
    if (!hfRef.current) return null
    try {
      const sheetId = hfRef.current.getSheetId(addr.sheet)
      if (sheetId === undefined) return null
      return hfRef.current.getCellFormula({ sheet: sheetId, row: addr.row, col: addr.col }) ?? null
    } catch { return null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const setCellValue = useCallback((addr: CellAddress, value: string) => {
    if (!hfRef.current) return
    const sheetId = hfRef.current.getSheetId(addr.sheet)
    if (sheetId === undefined) return
    hfRef.current.setCellContents({ sheet: sheetId, row: addr.row, col: addr.col }, [[value]])
    setTick(t => t + 1)
  }, [])

  const getSerializedData = useCallback((): SheetData => {
    const hf = hfRef.current
    if (!hf) return { Sheet1: [] }
    const result: SheetData = {}
    for (const name of hf.getSheetNames()) {
      const sheetId = hf.getSheetId(name)
      if (sheetId === undefined) { result[name] = []; continue }
      const { height, width } = hf.getSheetDimensions(sheetId)
      if (height === 0 || width === 0) { result[name] = []; continue }
      const rows: (string | number | boolean | null)[][] = []
      for (let r = 0; r < height; r++) {
        const row: (string | number | boolean | null)[] = []
        for (let c = 0; c < width; c++) {
          const formula = hf.getCellFormula({ sheet: sheetId, row: r, col: c })
          if (formula) {
            row.push(formula)
          } else {
            const val = hf.getCellValue({ sheet: sheetId, row: r, col: c })
            row.push(val instanceof Error ? null : (val as string | number | boolean | null) ?? null)
          }
        }
        rows.push(row)
      }
      result[name] = rows
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const getSheetNames = useCallback((): string[] => {
    return hfRef.current?.getSheetNames() ?? ['Sheet1']
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  return { getCellValue, getCellFormula, setCellValue, getSerializedData, getSheetNames }
}
