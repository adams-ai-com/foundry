import mammoth from 'mammoth'

export async function importDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  if (result.messages.length > 0) {
    console.warn('docx import warnings:', result.messages)
  }
  return result.value
}
