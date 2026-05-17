import ExcelJS from 'exceljs'

// ── CSV ──────────────────────────────────────────────────────────────────────

function csvParseField(s: string): string | number | null {
  if (s === '') return null
  const n = Number(s)
  return (!isNaN(n) && s.trim() !== '') ? n : s
}

export function parseCSV(text: string): (string | number | null)[][] {
  const rows: (string | number | null)[][] = []
  let row: (string | number | null)[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2 }
        else { inQuotes = false; i++ }
      } else { field += ch; i++ }
    } else {
      if (ch === '"') { inQuotes = true; i++ }
      else if (ch === ',') { row.push(csvParseField(field)); field = ''; i++ }
      else if (ch === '\r' && text[i + 1] === '\n') {
        row.push(csvParseField(field)); rows.push(row); row = []; field = ''; i += 2
      } else if (ch === '\n') {
        row.push(csvParseField(field)); rows.push(row); row = []; field = ''; i++
      } else { field += ch; i++ }
    }
  }

  if (field || row.length > 0) { row.push(csvParseField(field)); rows.push(row) }
  if (rows.length > 0 && rows[rows.length - 1].every(v => v === null)) rows.pop()
  return rows
}

export function serializeCSV(data: (string | number | boolean | null)[][]): string {
  return data.map(row =>
    row.map(cell => {
      if (cell === null || cell === undefined) return ''
      const s = String(cell)
      return (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r'))
        ? '"' + s.replace(/"/g, '""') + '"'
        : s
    }).join(',')
  ).join('\r\n')
}

// ── XLSX ─────────────────────────────────────────────────────────────────────

export async function importXlsx(file: File): Promise<{ name: string; data: (string | number | null)[][] }[]> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)

  return workbook.worksheets.map((ws) => {
    const data: (string | number | null)[][] = []
    ws.eachRow({ includeEmpty: true }, (row) => {
      const rowData: (string | number | null)[] = []
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.formula) {
          rowData.push(`=${cell.formula}`)
        } else if (cell.value === null || cell.value === undefined) {
          rowData.push(null)
        } else {
          rowData.push(cell.value as string | number)
        }
      })
      data.push(rowData)
    })
    return { name: ws.name, data }
  })
}

export async function exportXlsx(
  sheets: { name: string; data: (string | number | null)[][] }[]
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()

  for (const { name, data } of sheets) {
    const ws = workbook.addWorksheet(name)
    for (const row of data) {
      ws.addRow(row.map((v) => v ?? ''))
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
