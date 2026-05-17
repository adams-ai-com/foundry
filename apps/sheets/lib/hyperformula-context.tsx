'use client'

import React, { createContext, useContext } from 'react'
import { useHyperFormula } from './hyperformula'
import type { SheetData } from './actions'

type HFContextValue = ReturnType<typeof useHyperFormula>

const HyperFormulaContext = createContext<HFContextValue | null>(null)

export function HyperFormulaProvider({
  initialData,
  onChange,
  children,
}: {
  initialData?: SheetData
  onChange?: (data: SheetData) => void
  children: React.ReactNode
}) {
  const hf = useHyperFormula(initialData, onChange)
  return (
    <HyperFormulaContext.Provider value={hf}>
      {children}
    </HyperFormulaContext.Provider>
  )
}

export function useHyperFormulaContext(): HFContextValue {
  const ctx = useContext(HyperFormulaContext)
  if (!ctx) throw new Error('useHyperFormulaContext must be inside HyperFormulaProvider')
  return ctx
}
