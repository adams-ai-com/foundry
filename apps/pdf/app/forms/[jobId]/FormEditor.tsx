'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

type FieldType = 'text' | 'number' | 'date' | 'checkbox' | 'radio' | 'dropdown' | 'signature'
type Mode = 'build' | 'fill' | 'preview'

interface FieldDef {
  name: string
  label: string
  type: FieldType
  page: number
  rect: [number, number, number, number]  // PDF points
  value: string
  options: string[]
  required: boolean
}

interface PageMeta { width: number; height: number; widthPx: number; heightPx: number }

const RENDER_SCALE = 1.5
const THUMB_SCALE  = 0.2

// ── Field type meta ───────────────────────────────────────────────────────────

const FIELD_TYPES: { type: FieldType; label: string; color: string; icon: string }[] = [
  { type: 'text',      label: 'Text',      color: '#3b82f6', icon: 'Aa' },
  { type: 'number',    label: 'Number',    color: '#6366f1', icon: '#' },
  { type: 'date',      label: 'Date',      color: '#8b5cf6', icon: '📅' },
  { type: 'checkbox',  label: 'Checkbox',  color: '#16a34a', icon: '☑' },
  { type: 'radio',     label: 'Radio',     color: '#0891b2', icon: '◉' },
  { type: 'dropdown',  label: 'Dropdown',  color: '#ea580c', icon: '▾' },
  { type: 'signature', label: 'Signature', color: '#dc2626', icon: '✍' },
]

const TYPE_COLOR: Record<FieldType, string> = Object.fromEntries(
  FIELD_TYPES.map(f => [f.type, f.color])
) as Record<FieldType, string>

function needsOptions(t: FieldType) { return t === 'dropdown' || t === 'radio' }

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiPost(url: string, body: object) {
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

function svgCoords(e: React.MouseEvent<SVGSVGElement>): [number, number] {
  const r = e.currentTarget.getBoundingClientRect()
  return [e.clientX - r.left, e.clientY - r.top]
}

function autoName(type: FieldType, fields: FieldDef[]): string {
  const prefix: Record<FieldType, string> = {
    text: 'text', number: 'num', date: 'date',
    checkbox: 'cb', radio: 'radio', dropdown: 'select', signature: 'sig',
  }
  const count = fields.filter(f => f.type === type).length + 1
  return `${prefix[type]}_${count}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FormEditor({ jobId }: { jobId: string }) {
  const router = useRouter()

  // Page/doc state
  const [pageCount, setPageCount]   = useState(0)
  const [pageInfos, setPageInfos]   = useState<PageMeta[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [version, setVersion]       = useState(0)
  const [filename, setFilename]     = useState('document.pdf')

  // Form fields
  const [fields, setFields]         = useState<FieldDef[]>([])
  const [mode, setMode]             = useState<Mode>('build')
  const [saving, setSaving]         = useState(false)
  const [status, setStatus]         = useState('')

  // Build mode — placement
  const [activeTool, setActiveTool]     = useState<FieldType | null>(null)
  const [drawStart, setDrawStart]       = useState<[number, number] | null>(null)
  const [drawRect, setDrawRect]         = useState<[number,number,number,number] | null>(null)
  // Config popup (shown after rect is drawn)
  const [popup, setPopup]               = useState<{
    rect: [number,number,number,number];  // px coords
    type: FieldType
  } | null>(null)
  const [popupName, setPopupName]       = useState('')
  const [popupLabel, setPopupLabel]     = useState('')
  const [popupOptions, setPopupOptions] = useState('')
  const [popupRequired, setPopupRequired] = useState(false)

  // Fill mode
  const [fillValues, setFillValues] = useState<Record<string, string>>({})

  const svgRef   = useRef<SVGSVGElement>(null)
  const pageInfo = pageInfos[currentPage]

  // ── Load ─────────────────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    const [infoRes, metaRes, fieldsRes] = await Promise.all([
      fetch(`/pdf/api/pdf/${jobId}/info`),
      fetch(`/pdf/api/pdf/${jobId}/meta`),
      fetch(`/pdf/api/pdf/${jobId}/forms/fields`),
    ])
    if (infoRes.ok) {
      const d = await infoRes.json()
      setPageCount(d.pageCount)
      setPageInfos(d.pages)
    }
    if (metaRes.ok) {
      const m = await metaRes.json()
      setFilename(m.filename ?? 'document.pdf')
    }
    if (fieldsRes.ok) {
      const f = await fieldsRes.json()
      setFields(f.fields ?? [])
    }
  }, [jobId])

  useEffect(() => { reload() }, [reload])

  function bump() { setVersion(v => v + 1); reload() }

  function pageUrl(n: number, scale = RENDER_SCALE) {
    return `/pdf/api/pdf/${jobId}/page/${n}?scale=${scale}&v=${version}`
  }

  function toast(msg: string) {
    setStatus(msg)
    setTimeout(() => setStatus(''), 2500)
  }

  // ── SVG drawing ───────────────────────────────────────────────────────────

  function onMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (!activeTool || !pageInfo) return
    const pt = svgCoords(e)
    setDrawStart(pt)
    setDrawRect([pt[0], pt[1], pt[0], pt[1]])
  }

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!drawStart) return
    const [x, y] = svgCoords(e)
    setDrawRect([drawStart[0], drawStart[1], x, y])
  }

  function onMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (!drawStart || !drawRect || !activeTool) return
    const [x0, y0, x1, y1] = drawRect
    const w = Math.abs(x1 - x0)
    const h = Math.abs(y1 - y0)
    // Require a minimum size; checkboxes can be small
    const minSize = activeTool === 'checkbox' ? 8 : 20
    if (w > minSize && h > minSize / 2) {
      const name = autoName(activeTool, fields)
      setPopupName(name)
      setPopupLabel(name)
      setPopupOptions('')
      setPopupRequired(false)
      setPopup({ rect: drawRect, type: activeTool })
    }
    setDrawStart(null)
    setDrawRect(null)
  }

  // ── Add field ─────────────────────────────────────────────────────────────

  async function submitField() {
    if (!popup) return
    const [x0, y0, x1, y1] = popup.rect
    const normRect: [number,number,number,number] = [
      Math.min(x0, x1), Math.min(y0, y1),
      Math.max(x0, x1), Math.max(y0, y1),
    ]
    const options = popupOptions
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)

    setSaving(true)
    await apiPost(`/pdf/api/pdf/${jobId}/forms/add`, {
      type: popup.type, page: currentPage, scale: RENDER_SCALE,
      rect: normRect, name: popupName.trim() || popupLabel.trim() || 'field',
      label: popupLabel.trim() || popupName.trim(),
      options, required: popupRequired,
    })
    setPopup(null)
    bump()
    setSaving(false)
    toast('Field added')
  }

  // ── Remove field ──────────────────────────────────────────────────────────

  async function removeField(field: FieldDef) {
    if (!confirm(`Remove field "${field.name}"?`)) return
    setSaving(true)
    await apiPost(`/pdf/api/pdf/${jobId}/forms/remove`, { name: field.name, page: field.page })
    bump()
    setSaving(false)
    toast('Field removed')
  }

  // ── Fill form ─────────────────────────────────────────────────────────────

  async function applyFill() {
    setSaving(true)
    await apiPost(`/pdf/api/pdf/${jobId}/forms/fill`, { fields: fillValues })
    bump()
    setSaving(false)
    toast('Values applied — download to get filled PDF')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const pageFields = fields.filter(f => f.page === currentPage)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Toolbar */}
      <div className="h-11 bg-bg-raised border-b border-border flex items-center px-3 gap-2 shrink-0 overflow-x-auto">
        <button
          onClick={() => router.push('/pdf')}
          className="text-xs text-fg-tertiary hover:text-fg-primary flex items-center gap-1 mr-1 shrink-0"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
               strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          <span className="hidden sm:block">Files</span>
        </button>

        <span className="text-xs text-fg-secondary truncate max-w-[140px] shrink-0">{filename}</span>

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        {/* Mode tabs */}
        {(['build', 'fill', 'preview'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setPopup(null); setActiveTool(null) }}
            className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors
              ${mode === m ? 'bg-accent text-accent-fg' : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-hover'}
            `}
          >
            {m}
          </button>
        ))}

        <div className="flex-1" />

        {status && <span className="text-xs text-accent">{status}</span>}
        {saving && <span className="text-xs text-fg-tertiary">Saving…</span>}

        <a
          href={`/pdf/api/pdf/${jobId}/download`}
          className="text-xs text-fg-secondary hover:text-fg-primary border border-border rounded-md px-2.5 py-1.5 hover:bg-bg-hover shrink-0"
        >
          Download
        </a>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">

        {/* ── Build mode ─────────────────────────────────────────────────── */}
        {mode === 'build' && (
          <>
            {/* Left: field type palette */}
            <div className="w-44 bg-bg-surface border-r border-border flex flex-col shrink-0 py-3 gap-1 overflow-y-auto">
              <p className="text-[10px] uppercase tracking-wider text-fg-tertiary px-3 mb-1">Field types</p>
              {FIELD_TYPES.map(ft => (
                <button
                  key={ft.type}
                  onClick={() => setActiveTool(activeTool === ft.type ? null : ft.type)}
                  className={`flex items-center gap-2.5 mx-2 px-2.5 py-2 rounded-md text-left transition-colors text-sm
                    ${activeTool === ft.type
                      ? 'text-white ring-2 ring-white/30'
                      : 'text-fg-primary hover:bg-bg-hover'
                    }
                  `}
                  style={activeTool === ft.type ? { background: ft.color } : {}}
                >
                  <span className="text-base leading-none w-5 text-center">{ft.icon}</span>
                  <span className="font-medium text-xs">{ft.label}</span>
                </button>
              ))}
              {activeTool && (
                <p className="text-[10px] text-fg-tertiary px-3 mt-2">
                  Draw a rectangle on the page to place a {activeTool} field.
                </p>
              )}

              {/* Field list */}
              {fields.length > 0 && (
                <>
                  <div className="border-t border-border mx-2 mt-3 mb-2" />
                  <p className="text-[10px] uppercase tracking-wider text-fg-tertiary px-3">Fields ({fields.length})</p>
                  {fields.map((f, i) => (
                    <div
                      key={i}
                      onClick={() => setCurrentPage(f.page)}
                      className="flex items-center gap-2 mx-2 px-2 py-1.5 rounded-md hover:bg-bg-hover cursor-pointer group"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: TYPE_COLOR[f.type] }}
                      />
                      <span className="text-xs text-fg-primary truncate flex-1">{f.label || f.name}</span>
                      <span className="text-[10px] text-fg-tertiary shrink-0">p{f.page + 1}</span>
                      <button
                        onClick={e => { e.stopPropagation(); removeField(f) }}
                        className="opacity-0 group-hover:opacity-100 text-fg-tertiary hover:text-danger ml-1 text-xs"
                        title="Remove field"
                      >×</button>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Center: page view + SVG overlay */}
            <div className="flex-1 bg-bg-surface overflow-auto flex items-start justify-center p-6 relative">
              {pageInfo ? (
                <div className="relative inline-block shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pageUrl(currentPage)}
                    width={pageInfo.widthPx}
                    height={pageInfo.heightPx}
                    alt={`Page ${currentPage + 1}`}
                    style={{ display: 'block', userSelect: 'none' }}
                    draggable={false}
                  />

                  <svg
                    ref={svgRef}
                    style={{
                      position: 'absolute', top: 0, left: 0,
                      width: pageInfo.widthPx, height: pageInfo.heightPx,
                      cursor: activeTool ? 'crosshair' : 'default',
                      pointerEvents: activeTool ? 'all' : 'none',
                    }}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={() => { setDrawStart(null); setDrawRect(null) }}
                  >
                    {/* Existing fields overlay */}
                    {pageFields.map((f, i) => {
                      const [rx0, ry0, rx1, ry1] = f.rect.map(v => v * RENDER_SCALE)
                      const col = TYPE_COLOR[f.type]
                      return (
                        <g key={i}>
                          <rect
                            x={rx0} y={ry0} width={rx1-rx0} height={ry1-ry0}
                            fill={col + '22'} stroke={col} strokeWidth={1.5}
                          />
                          <text
                            x={rx0 + 3} y={ry0 + (ry1 - ry0) / 2 + 4}
                            fill={col} fontSize={9} fontFamily="sans-serif"
                          >
                            {f.label || f.name}
                          </text>
                        </g>
                      )
                    })}

                    {/* In-progress draw rect */}
                    {drawRect && (() => {
                      const [dx0, dy0, dx1, dy1] = drawRect
                      const col = activeTool ? TYPE_COLOR[activeTool] : '#3b82f6'
                      return (
                        <rect
                          x={Math.min(dx0,dx1)} y={Math.min(dy0,dy1)}
                          width={Math.abs(dx1-dx0)} height={Math.abs(dy1-dy0)}
                          fill={col + '33'} stroke={col}
                          strokeWidth={1.5} strokeDasharray="5 3"
                        />
                      )
                    })()}
                  </svg>

                  {/* Field config popup */}
                  {popup && (() => {
                    const [px0, py0, px1, py1] = popup.rect
                    const left = Math.max(Math.min(px0, px1) + 8, 0)
                    const top  = Math.max(Math.min(py0, py1) + 8, 0)
                    return (
                      <div
                        style={{ position: 'absolute', left, top, zIndex: 20 }}
                        className="bg-bg-raised border border-border rounded-xl shadow-card p-4 w-64"
                        onMouseDown={e => e.stopPropagation()}
                      >
                        <h3 className="text-xs font-semibold text-fg-primary mb-3 capitalize">
                          {popup.type} Field
                        </h3>

                        <label className="block mb-2">
                          <span className="text-[10px] text-fg-tertiary uppercase tracking-wide">Field name</span>
                          <input
                            value={popupName}
                            onChange={e => setPopupName(e.target.value)}
                            className="mt-0.5 w-full border border-border rounded-md px-2 py-1 text-xs bg-bg-base text-fg-primary"
                            autoFocus
                          />
                        </label>

                        <label className="block mb-2">
                          <span className="text-[10px] text-fg-tertiary uppercase tracking-wide">Label (displayed in Fill mode)</span>
                          <input
                            value={popupLabel}
                            onChange={e => setPopupLabel(e.target.value)}
                            className="mt-0.5 w-full border border-border rounded-md px-2 py-1 text-xs bg-bg-base text-fg-primary"
                          />
                        </label>

                        {needsOptions(popup.type) && (
                          <label className="block mb-2">
                            <span className="text-[10px] text-fg-tertiary uppercase tracking-wide">Options (one per line)</span>
                            <textarea
                              value={popupOptions}
                              onChange={e => setPopupOptions(e.target.value)}
                              rows={3}
                              placeholder="Option 1&#10;Option 2&#10;Option 3"
                              className="mt-0.5 w-full border border-border rounded-md px-2 py-1 text-xs bg-bg-base text-fg-primary resize-none"
                            />
                          </label>
                        )}

                        <label className="flex items-center gap-2 mb-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={popupRequired}
                            onChange={e => setPopupRequired(e.target.checked)}
                            className="accent-accent"
                          />
                          <span className="text-xs text-fg-secondary">Required</span>
                        </label>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setPopup(null)}
                            className="flex-1 text-xs text-fg-secondary hover:text-fg-primary border border-border rounded-md py-1.5"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={submitField}
                            disabled={saving}
                            className="flex-1 bg-accent text-accent-fg text-xs rounded-md py-1.5 hover:bg-accent-h"
                          >
                            {saving ? '…' : 'Add Field'}
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <div className="text-fg-tertiary text-sm">Loading…</div>
              )}
            </div>

            {/* Right: page thumbnail strip */}
            <div className="w-28 bg-bg-surface border-l border-border flex flex-col shrink-0 py-2 gap-1 overflow-y-auto">
              {Array.from({ length: pageCount }, (_, i) => (
                <div
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`mx-2 rounded-md border cursor-pointer overflow-hidden
                    ${currentPage === i ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-accent/40'}
                  `}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pageUrl(i, THUMB_SCALE)} alt={`p${i+1}`} className="w-full" draggable={false} />
                  <div className={`text-center text-[9px] py-0.5 ${currentPage === i ? 'text-accent font-semibold' : 'text-fg-tertiary'}`}>
                    {i+1}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Fill mode ─────────────────────────────────────────────────── */}
        {mode === 'fill' && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-6 py-8">
              <h2 className="text-lg font-semibold text-fg-primary mb-1">Fill Form</h2>
              <p className="text-sm text-fg-tertiary mb-6">
                {fields.length === 0
                  ? 'No form fields found. Switch to Build mode to add fields.'
                  : `${fields.length} field${fields.length !== 1 ? 's' : ''} across ${pageCount} page${pageCount !== 1 ? 's' : ''}.`
                }
              </p>

              {fields.length > 0 && (
                <>
                  <div className="space-y-4">
                    {fields.map((f, i) => (
                      <div key={i}>
                        <label className="block">
                          <span className="text-sm font-medium text-fg-primary">
                            {f.label || f.name}
                            {f.required && <span className="text-danger ml-1">*</span>}
                          </span>
                          <span className="text-xs text-fg-tertiary ml-2 capitalize">
                            {f.type} · p{f.page + 1}
                          </span>

                          {f.type === 'checkbox' ? (
                            <div className="mt-1">
                              <input
                                type="checkbox"
                                checked={fillValues[f.name] === 'true'}
                                onChange={e => setFillValues(v => ({ ...v, [f.name]: e.target.checked ? 'true' : 'false' }))}
                                className="accent-accent w-4 h-4"
                              />
                            </div>
                          ) : f.type === 'radio' ? (
                            <div className="mt-1 flex flex-wrap gap-3">
                              {f.options.map(opt => (
                                <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={f.name}
                                    value={opt}
                                    checked={fillValues[f.name] === opt}
                                    onChange={() => setFillValues(v => ({ ...v, [f.name]: opt }))}
                                    className="accent-accent"
                                  />
                                  <span className="text-sm text-fg-primary">{opt}</span>
                                </label>
                              ))}
                            </div>
                          ) : f.type === 'dropdown' ? (
                            <select
                              value={fillValues[f.name] ?? f.value ?? ''}
                              onChange={e => setFillValues(v => ({ ...v, [f.name]: e.target.value }))}
                              className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary"
                            >
                              <option value="">— select —</option>
                              {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : f.type === 'date' ? (
                            <input
                              type="date"
                              value={fillValues[f.name] ?? ''}
                              onChange={e => setFillValues(v => ({ ...v, [f.name]: e.target.value }))}
                              className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary"
                            />
                          ) : f.type === 'number' ? (
                            <input
                              type="number"
                              value={fillValues[f.name] ?? ''}
                              onChange={e => setFillValues(v => ({ ...v, [f.name]: e.target.value }))}
                              className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary"
                            />
                          ) : f.type === 'signature' ? (
                            <div className="mt-1 border-2 border-dashed border-border rounded-md px-3 py-4 text-xs text-fg-tertiary text-center">
                              Signature field — sign in your PDF reader after downloading
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={fillValues[f.name] ?? ''}
                              onChange={e => setFillValues(v => ({ ...v, [f.name]: e.target.value }))}
                              placeholder={f.label || f.name}
                              className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary"
                            />
                          )}
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex gap-3">
                    <button
                      onClick={applyFill}
                      disabled={saving}
                      className="bg-accent text-accent-fg px-5 py-2 rounded-lg text-sm font-medium hover:bg-accent-h"
                    >
                      {saving ? 'Applying…' : 'Apply values'}
                    </button>
                    <a
                      href={`/pdf/api/pdf/${jobId}/download`}
                      className="border border-border text-fg-secondary hover:text-fg-primary px-5 py-2 rounded-lg text-sm"
                    >
                      Download PDF
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Preview mode ──────────────────────────────────────────────── */}
        {mode === 'preview' && (
          <iframe
            src={`/pdf/api/pdf/${jobId}/file`}
            className="flex-1 border-0"
            title="PDF preview"
          />
        )}
      </div>
    </div>
  )
}
