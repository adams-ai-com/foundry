import { useCallback, useEffect, useRef, useState } from 'react'
import type { CellAddress } from '@foundry/shared'
import type { SheetData } from './actions'

type HFInstance = import('hyperformula').HyperFormula

export function serializeHF(hf: HFInstance): SheetData {
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
}

export function useHyperFormula(initialData?: SheetData, onChange?: (data: SheetData) => void) {
  const [tick, setTick] = useState(0)
  const hfRef = useRef<HFInstance | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

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
    if (onChangeRef.current) onChangeRef.current(serializeHF(hfRef.current))
  }, [])

  const getSerializedData = useCallback((): SheetData => {
    if (!hfRef.current) return { Sheet1: [] }
    return serializeHF(hfRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const getSheetNames = useCallback((): string[] => {
    return hfRef.current?.getSheetNames() ?? ['Sheet1']
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const addSheet = useCallback((name: string) => {
    if (!hfRef.current) return
    hfRef.current.addSheet(name)
    setTick(t => t + 1)
    if (onChangeRef.current) onChangeRef.current(serializeHF(hfRef.current))
  }, [])

  const loadSheets = useCallback((newData: SheetData) => {
    import('hyperformula').then(({ HyperFormula }) => {
      const sheets = Object.keys(newData).length > 0 ? newData : { Sheet1: [] }
      hfRef.current = HyperFormula.buildFromSheets(sheets, { licenseKey: 'gpl-v3' })
      setTick(t => t + 1)
      if (onChangeRef.current) onChangeRef.current(serializeHF(hfRef.current!))
    })
  }, [])

  const undo = useCallback(() => {
    if (!hfRef.current || !hfRef.current.isThereSomethingToUndo()) return
    hfRef.current.undo()
    setTick(t => t + 1)
    if (onChangeRef.current) onChangeRef.current(serializeHF(hfRef.current))
  }, [])

  const redo = useCallback(() => {
    if (!hfRef.current || !hfRef.current.isThereSomethingToRedo()) return
    hfRef.current.redo()
    setTick(t => t + 1)
    if (onChangeRef.current) onChangeRef.current(serializeHF(hfRef.current))
  }, [])

  const canUndo = useCallback((): boolean => {
    return hfRef.current?.isThereSomethingToUndo() ?? false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const canRedo = useCallback((): boolean => {
    return hfRef.current?.isThereSomethingToRedo() ?? false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const bulkSetCells = useCallback((addr: CellAddress, values: (string | number | null)[][]) => {
    if (!hfRef.current) return
    const sheetId = hfRef.current.getSheetId(addr.sheet)
    if (sheetId === undefined) return
    hfRef.current.setCellContents({ sheet: sheetId, row: addr.row, col: addr.col }, values)
    setTick(t => t + 1)
    if (onChangeRef.current) onChangeRef.current(serializeHF(hfRef.current))
  }, [])

  const addRows = useCallback((sheetName: string, rowIndex: number, count = 1) => {
    if (!hfRef.current) return
    const sheetId = hfRef.current.getSheetId(sheetName)
    if (sheetId === undefined) return
    hfRef.current.addRows(sheetId, [rowIndex, count])
    setTick(t => t + 1)
    if (onChangeRef.current) onChangeRef.current(serializeHF(hfRef.current))
  }, [])

  const removeRows = useCallback((sheetName: string, rowIndex: number, count = 1) => {
    if (!hfRef.current) return
    const sheetId = hfRef.current.getSheetId(sheetName)
    if (sheetId === undefined) return
    hfRef.current.removeRows(sheetId, [rowIndex, count])
    setTick(t => t + 1)
    if (onChangeRef.current) onChangeRef.current(serializeHF(hfRef.current))
  }, [])

  const addColumns = useCallback((sheetName: string, colIndex: number, count = 1) => {
    if (!hfRef.current) return
    const sheetId = hfRef.current.getSheetId(sheetName)
    if (sheetId === undefined) return
    hfRef.current.addColumns(sheetId, [colIndex, count])
    setTick(t => t + 1)
    if (onChangeRef.current) onChangeRef.current(serializeHF(hfRef.current))
  }, [])

  const removeColumns = useCallback((sheetName: string, colIndex: number, count = 1) => {
    if (!hfRef.current) return
    const sheetId = hfRef.current.getSheetId(sheetName)
    if (sheetId === undefined) return
    hfRef.current.removeColumns(sheetId, [colIndex, count])
    setTick(t => t + 1)
    if (onChangeRef.current) onChangeRef.current(serializeHF(hfRef.current))
  }, [])

  const renameSheet = useCallback((sheetName: string, newName: string) => {
    if (!hfRef.current) return
    const sheetId = hfRef.current.getSheetId(sheetName)
    if (sheetId === undefined) return
    hfRef.current.renameSheet(sheetId, newName)
    setTick(t => t + 1)
    if (onChangeRef.current) onChangeRef.current(serializeHF(hfRef.current))
  }, [])

  const removeSheet = useCallback((sheetName: string) => {
    if (!hfRef.current) return
    const sheetId = hfRef.current.getSheetId(sheetName)
    if (sheetId === undefined) return
    hfRef.current.removeSheet(sheetId)
    setTick(t => t + 1)
    if (onChangeRef.current) onChangeRef.current(serializeHF(hfRef.current))
  }, [])

  return { getCellValue, getCellFormula, setCellValue, getSerializedData, getSheetNames, addSheet, loadSheets, undo, redo, canUndo, canRedo, bulkSetCells, addRows, removeRows, addColumns, removeColumns, renameSheet, removeSheet }
}
