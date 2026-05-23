import { FormEditor } from './FormEditor'

interface Props { params: Promise<{ jobId: string }> }

export default async function FormsPage({ params }: Props) {
  const { jobId } = await params
  return <FormEditor jobId={jobId} />
}
