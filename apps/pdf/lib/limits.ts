import { NextResponse } from 'next/server'

export const MAX_PDF_BYTES = 100 * 1024 * 1024  // 100 MB
export const MAX_IMG_BYTES = 10 * 1024 * 1024   // 10 MB

export function checkFileSize(
  file: File,
  maxBytes: number,
): NextResponse | null {
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024))
    return NextResponse.json({ error: `File too large (max ${mb} MB)` }, { status: 413 })
  }
  return null
}
