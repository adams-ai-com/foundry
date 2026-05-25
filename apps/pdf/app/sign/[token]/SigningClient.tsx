'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FieldData {
  id: string
  page: number
  x0: number; y0: number; x1: number; y1: number
  field_type: 'signature' | 'initials' | 'date' | 'name'
  required: boolean
  completed: boolean
}

interface PageDim { width: number; height: number }

interface SigningData {
  envelope_id: string
  title: string
  creator_name: string
  expires_at: string | null
  recipient_id: string
  recipient_name: string
  recipient_email: string
  fields: FieldData[]
  page_count: number
  pages: PageDim[]
  status: string
}

interface SignedValue {
  dataUrl?: string   // for signature / initials (canvas PNG)
  text?: string      // for date / name (auto-filled)
}

const SIG_FONTS = [
  'Dancing Script', 'Great Vibes', 'Pacifico', 'Satisfy', 'Caveat',
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function fieldLabel(type: FieldData['field_type']) {
  return { signature: 'Signature', initials: 'Initials', date: 'Date', name: 'Full name' }[type]
}

function fieldColor(type: FieldData['field_type']) {
  return {
    signature: '#3b82f6', initials: '#8b5cf6', date: '#10b981', name: '#f59e0b',
  }[type]
}

// ── Sub-component: Signature capture modal ────────────────────────────────────

function CaptureModal({
  fieldType,
  recipientName,
  onCapture,
  onClose,
}: {
  fieldType: 'signature' | 'initials'
  recipientName: string
  onCapture: (dataUrl: string) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'draw' | 'type' | 'upload'>('draw')
  const [sigText, setSigText] = useState(
    fieldType === 'initials'
      ? recipientName.split(' ').map(n => n[0]).join('').toUpperCase()
      : recipientName
  )
  const [sigFont, setSigFont] = useState<typeof SIG_FONTS[number]>('Dancing Script')
  const [hasDrawn, setHasDrawn] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPt = useRef<[number, number] | null>(null)

  // Auto-render text signature when font or text changes
  useEffect(() => {
    if (tab !== 'type') return
    renderTextToCanvas()
  }, [sigText, sigFont, tab])

  function getCtx() {
    const c = canvasRef.current!
    return c.getContext('2d')!
  }

  function clearCanvas() {
    const c = canvasRef.current!
    getCtx().clearRect(0, 0, c.width, c.height)
    setHasDrawn(false)
  }

  function renderTextToCanvas() {
    const c = canvasRef.current!
    const ctx = getCtx()
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.font = `52px '${sigFont}'`
    ctx.fillStyle = '#1e3a5f'
    ctx.textBaseline = 'middle'
    const text = sigText || recipientName
    const mw = ctx.measureText(text).width
    const x = Math.max(12, (c.width - mw) / 2)
    ctx.fillText(text, x, c.height / 2)
    setHasDrawn(true)
  }

  function ptFromEvent(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement): [number, number] {
    const r = canvas.getBoundingClientRect()
    const scaleX = canvas.width / r.width
    const scaleY = canvas.height / r.height
    if ('touches' in e) {
      const t = e.touches[0]
      return [(t.clientX - r.left) * scaleX, (t.clientY - r.top) * scaleY]
    }
    return [(e.clientX - r.left) * scaleX, (e.clientY - r.top) * scaleY]
  }

  function onDrawStart(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    drawing.current = true
    const pt = ptFromEvent(e, canvasRef.current!)
    lastPt.current = pt
    const ctx = getCtx()
    ctx.beginPath()
    ctx.moveTo(pt[0], pt[1])
  }

  function onDrawMove(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!drawing.current) return
    const pt = ptFromEvent(e, canvasRef.current!)
    const ctx = getCtx()
    ctx.lineTo(pt[0], pt[1])
    ctx.strokeStyle = '#1e3a5f'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPt.current = pt
    setHasDrawn(true)
  }

  function onDrawEnd() {
    drawing.current = false
    lastPt.current = null
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const c = canvasRef.current!
      const ctx = getCtx()
      ctx.clearRect(0, 0, c.width, c.height)
      const scale = Math.min(c.width / img.width, c.height / img.height) * 0.9
      const x = (c.width - img.width * scale) / 2
      const y = (c.height - img.height * scale) / 2
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
      URL.revokeObjectURL(url)
      setHasDrawn(true)
    }
    img.src = url
  }

  function handleUse() {
    if (tab === 'type') renderTextToCanvas()
    const dataUrl = canvasRef.current!.toDataURL('image/png')
    onCapture(dataUrl)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {fieldType === 'initials' ? 'Your Initials' : 'Your Signature'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['draw', 'type', 'upload'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); clearCanvas(); if (t === 'type') setTimeout(renderTextToCanvas, 50) }}
              className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors
                ${tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Type tab controls */}
          {tab === 'type' && (
            <div className="mb-3 flex gap-2">
              <input
                value={sigText}
                onChange={e => setSigText(e.target.value)}
                placeholder="Your name"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={sigFont}
                onChange={e => setSigFont(e.target.value as any)}
                className="border border-gray-200 rounded-lg px-2 py-2 text-sm"
              >
                {SIG_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}

          {/* Upload tab controls */}
          {tab === 'upload' && (
            <div className="mb-3">
              <label className="block cursor-pointer">
                <span className="inline-block border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Choose image file
                </span>
                <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              </label>
            </div>
          )}

          {/* Canvas */}
          <div className={`relative rounded-xl overflow-hidden border-2 ${
            tab === 'draw' ? 'border-dashed border-gray-300 cursor-crosshair' : 'border-gray-200'
          }`}>
            <canvas
              ref={canvasRef}
              width={480}
              height={160}
              className="w-full"
              style={{ background: '#fafafa' }}
              onMouseDown={tab === 'draw' ? onDrawStart : undefined}
              onMouseMove={tab === 'draw' ? onDrawMove : undefined}
              onMouseUp={tab === 'draw' ? onDrawEnd : undefined}
              onMouseLeave={tab === 'draw' ? onDrawEnd : undefined}
              onTouchStart={tab === 'draw' ? onDrawStart : undefined}
              onTouchMove={tab === 'draw' ? onDrawMove : undefined}
              onTouchEnd={tab === 'draw' ? onDrawEnd : undefined}
            />
            {tab === 'draw' && !hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-gray-400">Sign here</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center mt-4">
            {tab === 'draw' ? (
              <button onClick={clearCanvas} className="text-sm text-gray-500 hover:text-gray-700">
                Clear
              </button>
            ) : <div />}
            <button
              onClick={handleUse}
              disabled={tab === 'draw' && !hasDrawn}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
                hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Use this {fieldType === 'initials' ? 'initials' : 'signature'} →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main signing client ───────────────────────────────────────────────────────

export function SigningClient({ token, initialData }: { token: string; initialData: SigningData }) {
  const d = initialData

  // Auto-fill date and name fields immediately
  const autoFill: Record<string, SignedValue> = {}
  for (const f of d.fields) {
    if (f.field_type === 'date') {
      autoFill[f.id] = { text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }
    } else if (f.field_type === 'name') {
      autoFill[f.id] = { text: d.recipient_name }
    }
  }

  const [signed, setSigned] = useState<Record<string, SignedValue>>(autoFill)
  const [activePage, setActivePage] = useState(0)
  const [captureField, setCaptureField] = useState<FieldData | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Jump to first page that has unsigned required fields
  useEffect(() => {
    const firstUnsignedPage = d.fields
      .filter(f => f.required && !autoFill[f.id] && !signed[f.id])
      .map(f => f.page)[0]
    if (firstUnsignedPage !== undefined) setActivePage(firstUnsignedPage)
  }, [])

  const signedCount = d.fields.filter(f => f.required && signed[f.id]).length
  const totalRequired = d.fields.filter(f => f.required).length
  const allSigned = signedCount === totalRequired

  const fieldsOnPage = (page: number) => d.fields.filter(f => f.page === page)
  const unsignedOnPage = (page: number) =>
    fieldsOnPage(page).filter(f => f.required && !signed[f.id]).length

  function handleCapture(dataUrl: string) {
    if (!captureField) return
    setSigned(prev => ({ ...prev, [captureField.id]: { dataUrl } }))
    setCaptureField(null)
  }

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)

    const submissions = d.fields.map(f => {
      const v = signed[f.id]
      return {
        field_id: f.id,
        field_type: f.field_type,
        image_b64: v?.dataUrl,
        text: v?.text,
      }
    })

    try {
      const res = await fetch(`/pdf/api/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: submissions,
          signer_name: d.recipient_name,
          signer_email: d.recipient_email,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSubmitError(err.error ?? 'Submission failed. Please try again.')
        return
      }
      setSubmitted(true)
    } catch {
      setSubmitError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Signed successfully</h1>
          <p className="text-sm text-gray-500 mb-1">
            Your signature has been applied to <strong>{d.title}</strong>.
          </p>
          <p className="text-sm text-gray-500">
            {d.creator_name} will be notified when all parties have signed.
          </p>
          <p className="text-xs text-gray-400 mt-8">Powered by Foundry PDF · Open source</p>
        </div>
      </div>
    )
  }

  const pageImg = (p: number) => `/pdf/api/sign/${token}/page/${p}`
  const pageDim = d.pages[activePage] ?? { width: 612, height: 792 }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-semibold text-gray-900 truncate max-w-xs">{d.title}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Requested by <strong>{d.creator_name}</strong>
            {d.expires_at && (
              <> · Expires {new Date(d.expires_at).toLocaleDateString()}</>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Signing as</p>
          <p className="text-sm font-medium text-gray-800">{d.recipient_name}</p>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
        {/* ── Left sidebar ─────────────────────────────────────────────────── */}
        <aside className="w-48 bg-white border-r border-gray-200 flex flex-col overflow-y-auto shrink-0">
          {/* Progress */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-700 mb-1">
              {signedCount} of {totalRequired} required
            </p>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${totalRequired ? (signedCount / totalRequired) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Page list */}
          <div className="flex-1 overflow-y-auto py-2">
            <p className="px-4 text-[10px] uppercase tracking-wider text-gray-400 mb-1">Pages</p>
            {Array.from({ length: d.page_count }, (_, i) => {
              const fieldCount = fieldsOnPage(i).length
              const unsigned = unsignedOnPage(i)
              return (
                <button
                  key={i}
                  onClick={() => setActivePage(i)}
                  className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between transition-colors
                    ${activePage === i ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <span>Page {i + 1}</span>
                  {fieldCount > 0 && (
                    <span className={`w-2 h-2 rounded-full ${unsigned > 0 ? 'bg-amber-400' : 'bg-green-400'}`} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Field checklist */}
          <div className="border-t border-gray-100 px-4 py-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Fields</p>
            {d.fields.filter(f => f.required).map(f => (
              <button
                key={f.id}
                onClick={() => { setActivePage(f.page); if (!signed[f.id] && (f.field_type === 'signature' || f.field_type === 'initials')) setCaptureField(f) }}
                className="w-full text-left flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 py-0.5"
              >
                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                  signed[f.id] ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}>
                  {signed[f.id] && (
                    <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className="truncate">{fieldLabel(f.field_type)} · p{f.page + 1}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* ── Main page view ────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto flex flex-col items-center py-6 px-4 gap-4">
          <div
            className="relative bg-white shadow-lg rounded"
            style={{ width: '100%', maxWidth: 760 }}
          >
            {/* Page image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pageImg(activePage)}
              alt={`Page ${activePage + 1}`}
              className="w-full block rounded"
              draggable={false}
            />

            {/* Field overlays */}
            {fieldsOnPage(activePage).map(f => {
              const pw = pageDim.width || 612
              const ph = pageDim.height || 792
              const pct = {
                left: `${(f.x0 / pw) * 100}%`,
                top: `${(f.y0 / ph) * 100}%`,
                width: `${((f.x1 - f.x0) / pw) * 100}%`,
                height: `${((f.y1 - f.y0) / ph) * 100}%`,
              }
              const isSigned = !!signed[f.id]
              const isAuto = f.field_type === 'date' || f.field_type === 'name'
              const color = fieldColor(f.field_type)

              return (
                <div
                  key={f.id}
                  className={`absolute rounded transition-all overflow-hidden
                    ${!isAuto ? 'cursor-pointer' : 'cursor-default'}`}
                  style={{
                    ...pct,
                    border: `2px ${isSigned ? 'solid' : 'dashed'} ${isSigned ? '#16a34a' : color}`,
                    background: isSigned
                      ? 'rgba(240,253,244,0.95)'
                      : isAuto ? 'rgba(254,249,195,0.9)' : 'rgba(239,246,255,0.85)',
                  }}
                  onClick={() => {
                    if (isAuto || isSigned) return
                    if (f.field_type === 'signature' || f.field_type === 'initials') {
                      setCaptureField(f)
                    }
                  }}
                >
                  {isSigned && signed[f.id].dataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={signed[f.id].dataUrl}
                      alt="Signature"
                      className="w-full h-full object-contain p-0.5"
                    />
                  ) : isSigned && signed[f.id].text ? (
                    <div className="w-full h-full flex items-center justify-center px-1">
                      <span className="text-xs text-gray-700 font-medium truncate">
                        {signed[f.id].text}
                      </span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                      {!isAuto && (
                        <svg className="w-3 h-3" fill="none" stroke={color} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      )}
                      <span className="text-[9px] font-medium truncate px-1" style={{ color }}>
                        {isAuto ? signed[f.id]?.text ?? fieldLabel(f.field_type) : `Click to sign`}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <button
              onClick={() => setActivePage(p => Math.max(0, p - 1))}
              disabled={activePage === 0}
              className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-xs">Page {activePage + 1} of {d.page_count}</span>
            <button
              onClick={() => setActivePage(p => Math.min(d.page_count - 1, p + 1))}
              disabled={activePage === d.page_count - 1}
              className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </main>
      </div>

      {/* ── Footer action bar ─────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div>
          {!allSigned && (
            <p className="text-xs text-amber-700 font-medium">
              {totalRequired - signedCount} field{totalRequired - signedCount !== 1 ? 's' : ''} remaining
            </p>
          )}
          {allSigned && (
            <p className="text-xs text-green-700 font-medium">✓ All fields complete — ready to submit</p>
          )}
          {submitError && <p className="text-xs text-red-600 mt-0.5">{submitError}</p>}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!allSigned || submitting}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg
            hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors shadow-sm"
        >
          {submitting ? 'Submitting…' : 'Sign Document →'}
        </button>
      </footer>

      {/* Signature capture modal */}
      {captureField && (captureField.field_type === 'signature' || captureField.field_type === 'initials') && (
        <CaptureModal
          fieldType={captureField.field_type}
          recipientName={d.recipient_name}
          onCapture={handleCapture}
          onClose={() => setCaptureField(null)}
        />
      )}
    </div>
  )
}
