'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SpreadsheetShell } from './SpreadsheetShell'
import { updateSpreadsheet, deleteSpreadsheet } from '@/lib/actions'
import type { Spreadsheet, SheetData, CellFormats } from '@/lib/actions'

const AUTOSAVE_MS = 1500

export function SpreadsheetEditor({ spreadsheet }: { spreadsheet: Spreadsheet }) {
  const [title, setTitle] = useState(spreadsheet.title)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleRef = useRef(spreadsheet.title)
  const dataRef = useRef<SheetData>(spreadsheet.data)
  const formatsRef = useRef<CellFormats>(spreadsheet.formats)

  const save = useCallback(async (t: string, d: SheetData, f: CellFormats) => {
    setSaveState('saving')
    await updateSpreadsheet(spreadsheet.id, t, d, f)
    setSaveState('saved')
  }, [spreadsheet.id])

  const scheduleSave = useCallback((t: string, d: SheetData, f: CellFormats) => {
    setSaveState('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(t, d, f), AUTOSAVE_MS)
  }, [save])

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setTitle(v)
    titleRef.current = v
    scheduleSave(v, dataRef.current, formatsRef.current)
  }

  function handleTitleBlur() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
      save(titleRef.current, dataRef.current, formatsRef.current)
    }
  }

  function handleDataChange(data: SheetData) {
    dataRef.current = data
    scheduleSave(titleRef.current, data, formatsRef.current)
  }

  function handleFormatsChange(formats: CellFormats) {
    formatsRef.current = formats
    scheduleSave(titleRef.current, dataRef.current, formats)
  }

  async function handleBack() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const isEmpty = title === 'Untitled' && Object.values(dataRef.current).every(s => s.length === 0)
    if (isEmpty) {
      await deleteSpreadsheet(spreadsheet.id)
    } else {
      await save(titleRef.current, dataRef.current, formatsRef.current)
    }
    window.location.href = '/'
  }

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  const saveIndicator =
    saveState === 'saving'  ? { dot: 'bg-amber-400 animate-pulse', text: 'Saving…',  textColor: 'text-gray-400' } :
    saveState === 'unsaved' ? { dot: 'bg-amber-400',               text: 'Unsaved',  textColor: 'text-amber-600' } :
                              { dot: 'bg-green-500',               text: 'Saved',    textColor: 'text-gray-400' }

  return (
    <>
      <div className="flex items-center gap-4 px-4 py-2.5 bg-white border-b border-gray-200 shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors shrink-0 group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Sheets
        </button>
        <div className="w-px h-5 bg-gray-200 shrink-0" />
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          onBlur={handleTitleBlur}
          placeholder="Untitled"
          data-testid="spreadsheet-title"
          className="flex-1 text-base font-semibold text-gray-900 bg-transparent border-none outline-none placeholder-gray-300 min-w-0"
        />
        <div className="flex items-center gap-2 shrink-0" data-testid="save-state">
          <span className={`w-2 h-2 rounded-full shrink-0 ${saveIndicator.dot}`} />
          <span className={`text-xs ${saveIndicator.textColor} hidden sm:block`}>{saveIndicator.text}</span>
        </div>
      </div>

      <SpreadsheetShell
        initialData={spreadsheet.data}
        initialFormats={spreadsheet.formats}
        onChange={handleDataChange}
        onFormatsChange={handleFormatsChange}
      />
    </>
  )
}
