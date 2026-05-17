'use server'

import { redirect } from 'next/navigation'
import sql from './db'

export type SheetData = Record<string, (string | number | boolean | null)[][]>

export type CellFormat = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  numFormat?: 'general' | 'number' | 'currency' | 'percent' | 'date'
}
// keyed: sheetName → "row:col" → CellFormat (sparse — only formatted cells present)
export type CellFormats = Record<string, Record<string, CellFormat>>

export interface Spreadsheet {
  id: string
  title: string
  data: SheetData
  formats: CellFormats
  created_at: string
  updated_at: string
}

export async function listSpreadsheets(): Promise<Omit<Spreadsheet, 'data' | 'formats'>[]> {
  return sql<Omit<Spreadsheet, 'data' | 'formats'>[]>`
    SELECT id, title, created_at, updated_at FROM spreadsheets ORDER BY updated_at DESC
  `
}

export async function getSpreadsheet(id: string): Promise<Spreadsheet | null> {
  const rows = await sql<(Omit<Spreadsheet, 'formats'> & { formats: CellFormats | null })[]>`
    SELECT id, title, data, formats, created_at, updated_at FROM spreadsheets WHERE id = ${id}
  `
  if (!rows[0]) return null
  return { ...rows[0], formats: rows[0].formats ?? {} }
}

export async function createSpreadsheet() {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO spreadsheets DEFAULT VALUES RETURNING id
  `
  redirect(`/editor/${rows[0].id}`)
}

export async function updateSpreadsheet(id: string, title: string, data: SheetData, formats: CellFormats) {
  await sql`
    UPDATE spreadsheets
    SET title = ${title},
        data = ${sql.json(data as Parameters<typeof sql.json>[0])},
        formats = ${sql.json(formats as Parameters<typeof sql.json>[0])}
    WHERE id = ${id}
  `
}

export async function deleteSpreadsheet(id: string) {
  await sql`DELETE FROM spreadsheets WHERE id = ${id}`
  redirect('/')
}
