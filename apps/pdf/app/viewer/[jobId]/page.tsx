import Link from 'next/link'

interface Props {
  params: Promise<{ jobId: string }>
}

export default async function ViewerPage({ params }: Props) {
  const { jobId } = await params

  // Fetch metadata from the proc to get the filename
  const procUrl = process.env.FOUNDRY_PDF_PROC_URL ?? 'http://127.0.0.1:3200'
  let filename = 'document.pdf'
  try {
    const res = await fetch(`${procUrl}/meta/${jobId}`, {
      headers: { 'X-Proc-Secret': process.env.FOUNDRY_PDF_PROC_SECRET ?? '' },
      cache: 'no-store',
    })
    if (res.ok) {
      const meta = await res.json()
      filename = meta.filename ?? filename
    }
  } catch {
    // proc unreachable — still render viewer
  }

  const fileUrl = `/pdf/api/pdf/${jobId}/file`
  const downloadUrl = `/pdf/api/pdf/${jobId}/download`

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Toolbar */}
      <div className="h-12 bg-bg-raised border-b border-border flex items-center px-4 gap-3 shrink-0">
        <Link
          href="/pdf"
          className="text-sm text-fg-tertiary hover:text-fg-primary transition-colors flex items-center gap-1"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
               strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          All files
        </Link>
        <div className="w-px h-4 bg-border shrink-0" />
        <span className="text-sm font-medium text-fg-primary truncate flex-1">{filename}</span>
        <a
          href={downloadUrl}
          className="flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg-primary
                     border border-border rounded-lg px-3 py-1.5 hover:bg-bg-hover transition-colors shrink-0"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
               strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download
        </a>
      </div>

      {/* PDF viewer — native browser rendering via iframe */}
      <div className="flex-1 bg-bg-surface overflow-hidden">
        <iframe
          src={fileUrl}
          className="w-full h-full border-0"
          title={filename}
        />
      </div>
    </div>
  )
}
