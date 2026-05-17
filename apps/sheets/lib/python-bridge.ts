'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useHyperFormulaContext } from './hyperformula-context'

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>
  globals: { set: (key: string, value: unknown) => void }
}

let pyodidePromise: Promise<PyodideInterface> | null = null

async function loadPyodide(): Promise<PyodideInterface> {
  if (pyodidePromise) return pyodidePromise
  pyodidePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js'
    script.onload = async () => {
      try {
        // @ts-expect-error — pyodide loaded via script tag
        const py = await window.loadPyodide()
        resolve(py)
      } catch (e) {
        reject(e)
      }
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
  return pyodidePromise
}

export function usePython() {
  const [ready, setReady] = useState(false)
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState('')
  const pyRef = useRef<PyodideInterface | null>(null)
  const { getCellValue, setCellValue } = useHyperFormulaContext()

  useEffect(() => {
    loadPyodide().then((py) => {
      pyRef.current = py
      setReady(true)
    })
  }, [])

  const run = useCallback(
    async (code: string) => {
      if (!pyRef.current) return
      setRunning(true)
      setOutput('')

      const lines: string[] = []

      // sheets API exposed to Python
      const sheetsApi = {
        get_cell: (addr: string) => {
          const parsed = parseAddressForPython(addr)
          if (!parsed) return null
          return getCellValue(parsed)
        },
        get_range: (range: string) => {
          return getRangeValues(range, getCellValue)
        },
        set_cell: (addr: string, value: unknown) => {
          const parsed = parseAddressForPython(addr)
          if (!parsed) return
          setCellValue(parsed, String(value))
        },
        set_range: (topLeft: string, values: unknown[][]) => {
          const start = parseAddressForPython(topLeft)
          if (!start) return
          values.forEach((row, r) => {
            row.forEach((val, c) => {
              setCellValue({ ...start, row: start.row + r, col: start.col + c }, String(val))
            })
          })
        },
      }

      pyRef.current.globals.set('sheets', sheetsApi)
      pyRef.current.globals.set('print', (...args: unknown[]) => {
        lines.push(args.join(' '))
        setOutput(lines.join('\n'))
      })

      try {
        await pyRef.current.runPythonAsync(code)
        if (lines.length === 0) setOutput('(no output)')
      } catch (e) {
        setOutput(`Error: ${(e as Error).message}`)
      } finally {
        setRunning(false)
      }
    },
    [getCellValue, setCellValue]
  )

  return { run, output, running, ready }
}

function parseAddressForPython(addr: string) {
  const match = addr.match(/^([A-Z]+)(\d+)$/)
  if (!match) return null
  const colStr = match[1]
  const row = parseInt(match[2], 10) - 1
  let col = 0
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64)
  }
  return { sheet: 'Sheet1', row, col: col - 1 }
}

function getRangeValues(range: string, getCellValue: (addr: { sheet: string; row: number; col: number }) => unknown) {
  const [start, end] = range.split(':')
  const s = parseAddressForPython(start)
  const e = parseAddressForPython(end)
  if (!s || !e) return []
  const result: unknown[][] = []
  for (let r = s.row; r <= e.row; r++) {
    const row: unknown[] = []
    for (let c = s.col; c <= e.col; c++) {
      row.push(getCellValue({ sheet: 'Sheet1', row: r, col: c }))
    }
    result.push(row)
  }
  return result
}
