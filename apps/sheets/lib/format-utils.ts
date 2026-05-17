import type { CellFormat } from './actions'

// Excel serial date → JS Date (epoch Jan 0, 1900 with leap-year quirk correction)
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)

export function applyNumFormat(
  value: string | number | boolean | null,
  numFormat?: CellFormat['numFormat'],
): string {
  if (value === null || value === undefined || value === '') return ''
  if (!numFormat || numFormat === 'general') return String(value)
  const n = Number(value)
  if (isNaN(n)) return String(value)
  switch (numFormat) {
    case 'number':
      return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
    case 'percent':
      return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(n)
    case 'date':
      return new Date(EXCEL_EPOCH_MS + n * 86_400_000).toLocaleDateString('en-US')
    default:
      return String(value)
  }
}
