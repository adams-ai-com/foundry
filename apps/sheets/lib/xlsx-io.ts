import ExcelJS from 'exceljs'

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
