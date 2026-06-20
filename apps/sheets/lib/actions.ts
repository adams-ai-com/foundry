'use server'

import { redirect } from 'next/navigation'
import sql from './db'

export type SheetData = Record<string, (string | number | boolean | null)[][]>

export type CellFormat = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  wrapText?: boolean
  align?: 'left' | 'center' | 'right'
  color?: string
  fillColor?: string
  fontSize?: number
  borders?: {
    top?: string | null
    right?: string | null
    bottom?: string | null
    left?: string | null
  }
  numFormat?: 'general' | 'number' | 'currency' | 'percent' | 'date'
}
// keyed: sheetName → "row:col" → CellFormat (sparse — only formatted cells present)
export type CellFormats = Record<string, Record<string, CellFormat>>

export type ChartDef = {
  id: string
  type: 'bar' | 'line' | 'pie'
  title: string
  sheet: string
  range: string
  firstRowHeader: boolean
  firstColLabel: boolean
}

export type MergedRange = {
  sheet: string
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

export interface Spreadsheet {
  id: string
  title: string
  data: SheetData
  formats: CellFormats
  charts: ChartDef[]
  merges: MergedRange[]
  created_at: string
  updated_at: string
}

export async function listSpreadsheets(): Promise<Omit<Spreadsheet, 'data' | 'formats' | 'charts' | 'merges'>[]> {
  return sql<Omit<Spreadsheet, 'data' | 'formats' | 'charts' | 'merges'>[]>`
    SELECT id, title, created_at, updated_at FROM spreadsheets ORDER BY updated_at DESC
  `
}

export async function getSpreadsheet(id: string): Promise<Spreadsheet | null> {
  const rows = await sql<(Omit<Spreadsheet, 'formats' | 'charts' | 'merges'> & { formats: CellFormats | null; charts: ChartDef[] | null; merges: MergedRange[] | null })[]>`
    SELECT id, title, data, formats, charts, merges, created_at, updated_at FROM spreadsheets WHERE id = ${id}
  `
  if (!rows[0]) return null
  return { ...rows[0], formats: rows[0].formats ?? {}, charts: rows[0].charts ?? [], merges: rows[0].merges ?? [] }
}

export async function createSpreadsheet() {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO spreadsheets DEFAULT VALUES RETURNING id
  `
  redirect(`/editor/${rows[0].id}`)
}

export async function updateSpreadsheet(id: string, title: string, data: SheetData, formats: CellFormats, charts: ChartDef[], merges: MergedRange[]) {
  await sql`
    UPDATE spreadsheets
    SET title = ${title},
        data = ${sql.json(data as Parameters<typeof sql.json>[0])},
        formats = ${sql.json(formats as Parameters<typeof sql.json>[0])},
        charts = ${sql.json(charts as Parameters<typeof sql.json>[0])},
        merges = ${sql.json(merges as Parameters<typeof sql.json>[0])}
    WHERE id = ${id}
  `
}

export async function deleteSpreadsheet(id: string) {
  await sql`DELETE FROM spreadsheets WHERE id = ${id}`
}
