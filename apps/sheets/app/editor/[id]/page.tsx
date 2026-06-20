import { notFound } from 'next/navigation'
import { getSpreadsheet } from '@/lib/actions'
import { SpreadsheetEditor } from '@/components/SpreadsheetEditor'

export const dynamic = 'force-dynamic'

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const spreadsheet = await getSpreadsheet(id)
  if (!spreadsheet) notFound()
  return (
    <div className="h-screen flex flex-col bg-bg-base">
      <SpreadsheetEditor spreadsheet={spreadsheet} />
    </div>
  )
}
