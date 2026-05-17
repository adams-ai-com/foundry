'use server'

import { redirect } from 'next/navigation'
import sql from './db'

export type SheetData = Record<string, (string | number | boolean | null)[][]>

export interface Spreadsheet {
  id: string
  title: string
  data: SheetData
  created_at: string
  updated_at: string
}

export async function listSpreadsheets(): Promise<Omit<Spreadsheet, 'data'>[]> {
  return sql<Omit<Spreadsheet, 'data'>[]>`
    SELECT id, title, created_at, updated_at FROM spreadsheets ORDER BY updated_at DESC
  `
}

export async function getSpreadsheet(id: string): Promise<Spreadsheet | null> {
  const rows = await sql<Spreadsheet[]>`
    SELECT id, title, data, created_at, updated_at FROM spreadsheets WHERE id = ${id}
  `
  return rows[0] ?? null
}

export async function createSpreadsheet() {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO spreadsheets DEFAULT VALUES RETURNING id
  `
  redirect(`/editor/${rows[0].id}`)
}

export async function updateSpreadsheet(id: string, title: string, data: SheetData) {
  await sql`
    UPDATE spreadsheets SET title = ${title}, data = ${sql.json(data as Parameters<typeof sql.json>[0])} WHERE id = ${id}
  `
}

export async function deleteSpreadsheet(id: string) {
  await sql`DELETE FROM spreadsheets WHERE id = ${id}`
  redirect('/')
}
