import { notFound } from 'next/navigation'
import { getDocument } from '@/lib/actions'
import { Editor } from '@/components/Editor'

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const doc = await getDocument(id)
  if (!doc) notFound()

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Editor doc={doc} />
    </div>
  )
}
