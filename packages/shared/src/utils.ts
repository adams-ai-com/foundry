export function colIndexToLetter(index: number): string {
  let letter = ''
  let n = index + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}

export function cellAddress(row: number, col: number): string {
  return `${colIndexToLetter(col)}${row + 1}`
}

export function parseAddress(address: string): { col: number; row: number } | null {
  const match = address.match(/^([A-Z]+)(\d+)$/)
  if (!match) return null
  const colStr = match[1]
  const row = parseInt(match[2], 10) - 1
  let col = 0
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64)
  }
  return { col: col - 1, row }
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).format(date)
}
