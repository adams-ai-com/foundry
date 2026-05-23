import { Editor } from './Editor'

interface Props { params: Promise<{ jobId: string }> }

export default async function EditorPage({ params }: Props) {
  const { jobId } = await params
  return <Editor jobId={jobId} />
}
