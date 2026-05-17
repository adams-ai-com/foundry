import { useCallback, useRef, useState } from 'react'
import type { CellAddress, CellData } from '@foundry/shared'
import { cellAddress, parseAddress } from '@foundry/shared'

// HyperFormula is loaded dynamically to avoid SSR issues
let hfInstance: import('hyperformula').HyperFormula | null = null

async function getHF() {
  if (hfInstance) return hfInstance
  const { HyperFormula } = await import('hyperformula')
  hfInstance = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' })
  hfInstance.addSheet('Sheet1')
  return hfInstance
}

// React hook — manages HyperFormula state and triggers re-renders on changes
export function useHyperFormula() {
  const [tick, setTick] = useState(0)
  const hfRef = useRef<import('hyperformula').HyperFormula | null>(null)

  // Initialize lazily
  if (typeof window !== 'undefined' && !hfRef.current) {
    getHF().then((hf) => {
      hfRef.current = hf
      setTick((t) => t + 1)
    })
  }

  const getCellValue = useCallback(
    (addr: CellAddress): string | number | boolean | null => {
      if (!hfRef.current) return null
      try {
        const sheetId = hfRef.current.getSheetId(addr.sheet)
        if (sheetId === undefined) return null
        const val = hfRef.current.getCellValue({ sheet: sheetId, row: addr.row, col: addr.col })
        if (val instanceof Error) return `#ERR: ${val.message}`
        return val as string | number | boolean | null
      } catch {
        return null
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick]
  )

  const getCellFormula = useCallback(
    (addr: CellAddress): string | null => {
      if (!hfRef.current) return null
      try {
        const sheetId = hfRef.current.getSheetId(addr.sheet)
        if (sheetId === undefined) return null
        const formula = hfRef.current.getCellFormula({ sheet: sheetId, row: addr.row, col: addr.col })
        return formula ?? null
      } catch {
        return null
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick]
  )

  const setCellValue = useCallback(
    (addr: CellAddress, value: string) => {
      if (!hfRef.current) return
      const sheetId = hfRef.current.getSheetId(addr.sheet)
      if (sheetId === undefined) return
      hfRef.current.setCellContents({ sheet: sheetId, row: addr.row, col: addr.col }, [[value]])
      setTick((t) => t + 1)
    },
    []
  )

  return { getCellValue, getCellFormula, setCellValue }
}
