'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ────────────────────────────────────────────────────────────────────

interface PageMeta { width: number; height: number; widthPx: number; heightPx: number }
type Tool = 'select' | 'text' | 'sticky' | 'arrow' | 'freehand'

type DrawPhase =
  | { kind: 'idle' }
  | { kind: 'arrow'; x0: number; y0: number; x1: number; y1: number }
  | { kind: 'freehand'; pts: [number, number][] }
  | { kind: 'text-placing'; x: number; y: number; sticky: boolean }

const RENDER_SCALE = 1.5
const THUMB_SCALE  = 0.2
const COLORS = ['#000000', '#ef4444', '#3b82f6', '#16a34a', '#f59e0b', '#8b5cf6']

// ── Helpers ──────────────────────────────────────────────────────────────────

function svgPoint(e: React.MouseEvent<SVGSVGElement>): [number, number] {
  const rect = e.currentTarget.getBoundingClientRect()
  return [e.clientX - rect.left, e.clientY - rect.top]
}

async function apiPost(url: string, body: object) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

// ── Icons ────────────────────────────────────────────────────────────────────

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  select:    'M5 3l14 9-7 2-3 7z',
  text:      'M4 7V4h16v3M9 20h6M12 4v16',
  sticky:    'M8 2H6a2 2 0 0 0-2 2v14l4-4h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-2M8 2v4M16 2v4',
  arrow:     'M5 12h14M15 6l6 6-6 6',
  freehand:  'M3 17c3-3 5-6 9-6s6 3 9 6',
  rotateCw:  'M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8',
  rotateCcw: 'M3 2v6h6M21 12a9 9 0 0 1-15 6.7L3 16',
  trash:     'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  copy:      'M8 8H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2M10 4h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  merge:     'M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 8v8M9 11l3-3 3 3',
  scissors:  'M6 2v11M6 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 6l12 9M18 6L6 15',
  download:  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  back:      'M19 12H5M12 5l-7 7 7 7',
}

// ── Toolbar button ───────────────────────────────────────────────────────────

function TBtn({
  icon, label, active = false, onClick, disabled = false, title,
}: {
  icon: string; label?: string; active?: boolean; onClick: () => void; disabled?: boolean; title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
        transition-colors select-none
        ${active
          ? 'bg-accent text-accent-fg'
          : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-hover'
        }
        ${disabled ? 'opacity-40 pointer-events-none' : ''}
      `}
    >
      <Icon d={ICONS[icon as keyof typeof ICONS]} />
      {label && <span className="hidden sm:block">{label}</span>}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-5 bg-border mx-1 shrink-0" />
}

// ── Main component ───────────────────────────────────────────────────────────

export function Editor({ jobId }: { jobId: string }) {
  const router = useRouter()

  // Page state
  const [pageCount, setPageCount] = useState(0)
  const [pageInfos, setPageInfos] = useState<PageMeta[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [version, setVersion] = useState(0)  // bump to reload PNGs
  const [filename, setFilename] = useState('document.pdf')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  // Tool state
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState('#000000')
  const [draw, setDraw] = useState<DrawPhase>({ kind: 'idle' })
  const [textVal, setTextVal] = useState('')

  // Drag-to-reorder state
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  // Dialogs
  const [splitDialog, setSplitDialog] = useState(false)
  const [splitStart, setSplitStart] = useState('1')
  const [splitEnd, setSplitEnd]     = useState('1')

  const mergeInputRef = useRef<HTMLInputElement>(null)
  const textInputRef  = useRef<HTMLInputElement>(null)
  const svgRef        = useRef<SVGSVGElement>(null)

  const pageInfo = pageInfos[currentPage]

  // ── Load info ──────────────────────────────────────────────────────────────

  const loadInfo = useCallback(async () => {
    const [infoRes, metaRes] = await Promise.all([
      fetch(`/pdf/api/pdf/${jobId}/info`),
      fetch(`/pdf/api/pdf/${jobId}/meta`),
    ])
    if (infoRes.ok) {
      const d = await infoRes.json()
      setPageCount(d.pageCount)
      setPageInfos(d.pages)
      setSplitEnd(String(d.pageCount))
    }
    if (metaRes.ok) {
      const m = await metaRes.json()
      setFilename(m.filename ?? 'document.pdf')
    }
  }, [jobId])

  useEffect(() => { loadInfo() }, [loadInfo])

  function bump() {
    setVersion(v => v + 1)
    loadInfo()
  }

  function pageUrl(n: number, scale = RENDER_SCALE) {
    return `/pdf/api/pdf/${jobId}/page/${n}?scale=${scale}&v=${version}`
  }

  function toast(msg: string) {
    setStatus(msg)
    setTimeout(() => setStatus(''), 2500)
  }

  // ── Page operations ────────────────────────────────────────────────────────

  async function rotate(angle: 90 | -90) {
    setSaving(true)
    await apiPost(`/pdf/api/pdf/${jobId}/pages/rotate`, { page: currentPage, angle })
    bump()
    setSaving(false)
    toast('Rotated')
  }

  async function deletePage() {
    if (pageCount <= 1) return
    if (!confirm(`Delete page ${currentPage + 1}?`)) return
    setSaving(true)
    const next = currentPage > 0 ? currentPage - 1 : 0
    await apiPost(`/pdf/api/pdf/${jobId}/pages/delete`, { page: currentPage })
    setCurrentPage(next)
    bump()
    setSaving(false)
    toast('Page deleted')
  }

  async function duplicatePage() {
    setSaving(true)
    await apiPost(`/pdf/api/pdf/${jobId}/pages/duplicate`, { page: currentPage })
    bump()
    setSaving(false)
    toast('Page duplicated')
  }

  async function handleReorder(from: number, to: number) {
    if (from === to) return
    const order = Array.from({ length: pageCount }, (_, i) => i)
    order.splice(from, 1)
    order.splice(to, 0, from)
    setSaving(true)
    await apiPost(`/pdf/api/pdf/${jobId}/pages/reorder`, { order })
    setCurrentPage(to)
    bump()
    setSaving(false)
    toast('Pages reordered')
  }

  async function handleMerge(file: File) {
    setSaving(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/pdf/api/pdf/${jobId}/merge`, { method: 'POST', body: form })
    const d = await res.json()
    bump()
    setSaving(false)
    toast(`Merged — ${d.pageCount} pages total`)
  }

  async function handleSplit() {
    const start = parseInt(splitStart) - 1
    const end   = parseInt(splitEnd) - 1
    if (isNaN(start) || isNaN(end) || start > end || start < 0 || end >= pageCount) {
      toast('Invalid page range')
      return
    }
    setSaving(true)
    const d = await apiPost(`/pdf/api/pdf/${jobId}/split`, { start, end })
    setSplitDialog(false)
    setSaving(false)
    if (d.jobId) {
      toast(`Split created — opening…`)
      setTimeout(() => router.push(`/pdf/editor/${d.jobId}`), 1000)
    }
  }

  // ── Annotation ─────────────────────────────────────────────────────────────

  async function saveAnnotation(body: object) {
    setSaving(true)
    await apiPost(`/pdf/api/pdf/${jobId}/annotate`, body)
    bump()
    setSaving(false)
  }

  // ── SVG interaction ────────────────────────────────────────────────────────

  const toolCursor: Record<Tool, string> = {
    select: 'default',
    text: 'text',
    sticky: 'cell',
    arrow: 'crosshair',
    freehand: 'crosshair',
  }

  function onSvgDown(e: React.MouseEvent<SVGSVGElement>) {
    if (tool === 'select' || !pageInfo) return
    const [x, y] = svgPoint(e)

    if (tool === 'text' || tool === 'sticky') {
      setDraw({ kind: 'text-placing', x, y, sticky: tool === 'sticky' })
      setTextVal('')
      setTimeout(() => textInputRef.current?.focus(), 50)
      return
    }
    if (tool === 'arrow') {
      setDraw({ kind: 'arrow', x0: x, y0: y, x1: x, y1: y })
      return
    }
    if (tool === 'freehand') {
      setDraw({ kind: 'freehand', pts: [[x, y]] })
      return
    }
  }

  function onSvgMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!pageInfo) return
    const [x, y] = svgPoint(e)
    if (draw.kind === 'arrow') {
      setDraw({ ...draw, x1: x, y1: y })
    } else if (draw.kind === 'freehand') {
      setDraw({ kind: 'freehand', pts: [...draw.pts, [x, y]] })
    }
  }

  async function onSvgUp(e: React.MouseEvent<SVGSVGElement>) {
    if (!pageInfo || draw.kind === 'idle' || draw.kind === 'text-placing') return
    const [x, y] = svgPoint(e)

    if (draw.kind === 'arrow') {
      const dx = draw.x1 - draw.x0
      const dy = draw.y1 - draw.y0
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        await saveAnnotation({
          type: 'arrow', page: currentPage, scale: RENDER_SCALE, color,
          p1: [draw.x0, draw.y0], p2: [draw.x1, draw.y1],
        })
      }
    }

    if (draw.kind === 'freehand' && draw.pts.length >= 2) {
      await saveAnnotation({
        type: 'freehand', page: currentPage, scale: RENDER_SCALE, color,
        inkList: draw.pts,
      })
    }

    setDraw({ kind: 'idle' })
  }

  async function commitText() {
    if (draw.kind !== 'text-placing' || !textVal.trim()) {
      setDraw({ kind: 'idle' })
      return
    }
    const { x, y, sticky } = draw
    const PAD = 4
    const W = Math.max(textVal.length * 7 + PAD * 2, 120)
    const H = 28
    await saveAnnotation({
      type: sticky ? 'sticky' : 'textbox',
      page: currentPage, scale: RENDER_SCALE, color,
      rect: [x, y, x + W, y + H],
      content: textVal.trim(),
      fontSize: 12,
    })
    setDraw({ kind: 'idle' })
    setTextVal('')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (pageCount === 0 && pageInfos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-fg-tertiary text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="h-11 bg-bg-raised border-b border-border flex items-center px-3 gap-1 shrink-0 overflow-x-auto">
        <button
          onClick={() => router.push('/pdf')}
          className="flex items-center gap-1 text-xs text-fg-tertiary hover:text-fg-primary mr-2 shrink-0"
        >
          <Icon d={ICONS.back} size={14} />
          <span className="hidden sm:block">Files</span>
        </button>

        <span className="text-xs text-fg-secondary truncate max-w-[160px] shrink-0">{filename}</span>
        {saving && <span className="text-xs text-fg-tertiary ml-1 shrink-0">Saving…</span>}
        {status && <span className="text-xs text-accent ml-1 shrink-0">{status}</span>}

        <div className="flex-1 min-w-2" />

        {/* Annotation tools */}
        {(['select','text','sticky','arrow','freehand'] as Tool[]).map(t => (
          <TBtn key={t} icon={t} active={tool === t} onClick={() => { setTool(t); setDraw({ kind: 'idle' }) }} />
        ))}

        {/* Color swatches */}
        <div className="flex gap-0.5 ml-1">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              title={c}
              className={`w-4 h-4 rounded-full border-2 transition-transform
                ${color === c ? 'border-fg-primary scale-110' : 'border-transparent'}
              `}
              style={{ background: c }}
            />
          ))}
        </div>

        <Sep />

        {/* Page ops */}
        <TBtn icon="rotateCcw" onClick={() => rotate(-90)} title="Rotate left" />
        <TBtn icon="rotateCw"  onClick={() => rotate(90)}  title="Rotate right" />
        <TBtn icon="copy"  onClick={duplicatePage} title="Duplicate page" />
        <TBtn icon="trash" onClick={deletePage} disabled={pageCount <= 1} title="Delete page" />

        <Sep />

        {/* Merge / split */}
        <TBtn icon="merge"    onClick={() => mergeInputRef.current?.click()} title="Merge PDF" />
        <TBtn icon="scissors" onClick={() => { setSplitStart('1'); setSplitEnd(String(pageCount)); setSplitDialog(true) }} title="Split PDF" />
        <input
          ref={mergeInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={e => { if (e.target.files?.[0]) { handleMerge(e.target.files[0]); e.target.value = '' } }}
        />

        <Sep />

        <a
          href={`/pdf/forms/${jobId}`}
          className="flex items-center gap-1.5 text-xs text-fg-secondary hover:text-fg-primary px-2 py-1.5 rounded-md hover:bg-bg-hover"
          title="Form Builder"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
               strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          <span className="hidden sm:block">Forms</span>
        </a>

        <a
          href={`/pdf/api/pdf/${jobId}/download`}
          className="flex items-center gap-1.5 text-xs text-fg-secondary hover:text-fg-primary px-2 py-1.5 rounded-md hover:bg-bg-hover"
          title="Download"
        >
          <Icon d={ICONS.download} size={14} />
          <span className="hidden sm:block">Download</span>
        </a>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Sidebar: thumbnail strip */}
        <div className="w-[160px] bg-bg-surface border-r border-border flex flex-col shrink-0 overflow-y-auto py-2 gap-1">
          {Array.from({ length: pageCount }, (_, i) => {
            const isDragTarget = dragOver === i && dragFrom !== null && dragFrom !== i
            return (
              <div
                key={i}
                draggable
                onDragStart={() => setDragFrom(i)}
                onDragOver={e => { e.preventDefault(); setDragOver(i) }}
                onDrop={() => { handleReorder(dragFrom!, i); setDragFrom(null); setDragOver(null) }}
                onDragEnd={() => { setDragFrom(null); setDragOver(null) }}
                onClick={() => setCurrentPage(i)}
                className={`mx-2 rounded-md border cursor-pointer overflow-hidden select-none transition-all
                  ${currentPage === i ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-accent/40'}
                  ${isDragTarget ? 'ring-2 ring-accent/60 scale-95' : ''}
                  ${dragFrom === i ? 'opacity-40' : ''}
                `}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pageUrl(i, THUMB_SCALE)}
                  alt={`Page ${i + 1}`}
                  className="w-full"
                  draggable={false}
                />
                <div className={`text-center text-[10px] py-0.5
                  ${currentPage === i ? 'text-accent font-semibold' : 'text-fg-tertiary'}
                `}>
                  {i + 1}
                </div>
              </div>
            )
          })}
        </div>

        {/* Page view */}
        <div className="flex-1 bg-bg-surface overflow-auto flex items-start justify-center p-6">
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

              {/* SVG annotation overlay */}
              <svg
                ref={svgRef}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: pageInfo.widthPx, height: pageInfo.heightPx,
                  cursor: toolCursor[tool],
                  pointerEvents: tool === 'select' ? 'none' : 'all',
                }}
                onMouseDown={onSvgDown}
                onMouseMove={onSvgMove}
                onMouseUp={onSvgUp}
                onMouseLeave={onSvgUp}
              >
                {/* In-progress arrow */}
                {draw.kind === 'arrow' && (
                  <line
                    x1={draw.x0} y1={draw.y0} x2={draw.x1} y2={draw.y1}
                    stroke={color} strokeWidth={2}
                    markerEnd="url(#arrowhead)"
                  />
                )}

                {/* In-progress freehand */}
                {draw.kind === 'freehand' && draw.pts.length >= 2 && (
                  <polyline
                    points={draw.pts.map(p => `${p[0]},${p[1]}`).join(' ')}
                    fill="none" stroke={color} strokeWidth={2}
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                )}

                {/* Arrow marker def */}
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6"
                          refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill={color} />
                  </marker>
                </defs>
              </svg>

              {/* Text / sticky input popup */}
              {draw.kind === 'text-placing' && (
                <div
                  style={{ position: 'absolute', left: draw.x, top: draw.y, zIndex: 10 }}
                  className="flex"
                >
                  {draw.sticky && (
                    <div className="w-6 h-6 rounded-sm flex items-center justify-center mr-1"
                         style={{ background: '#fef08a' }}>
                      <Icon d={ICONS.sticky} size={12} />
                    </div>
                  )}
                  <input
                    ref={textInputRef}
                    value={textVal}
                    onChange={e => setTextVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setDraw({ kind: 'idle' }) }}
                    onBlur={commitText}
                    placeholder={draw.sticky ? 'Sticky note…' : 'Type text…'}
                    className="border border-accent bg-white text-black text-sm px-2 py-0.5 rounded shadow-lg outline-none"
                    style={{ minWidth: 120, color: color !== '#000000' ? color : '#000' }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-fg-tertiary text-sm">No pages</div>
          )}
        </div>
      </div>

      {/* ── Split dialog ─────────────────────────────────────────────────── */}
      {splitDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-bg-raised rounded-xl border border-border shadow-card p-6 w-80">
            <h2 className="text-sm font-semibold text-fg-primary mb-4">Split PDF</h2>
            <p className="text-xs text-fg-secondary mb-4">
              Extract a page range into a new file. Original is unchanged.
              Document has {pageCount} page{pageCount !== 1 ? 's' : ''}.
            </p>
            <div className="flex gap-3 mb-5">
              <label className="flex-1">
                <span className="text-xs text-fg-tertiary block mb-1">From page</span>
                <input
                  type="number" min={1} max={pageCount}
                  value={splitStart}
                  onChange={e => setSplitStart(e.target.value)}
                  className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-bg-base text-fg-primary"
                />
              </label>
              <label className="flex-1">
                <span className="text-xs text-fg-tertiary block mb-1">To page</span>
                <input
                  type="number" min={1} max={pageCount}
                  value={splitEnd}
                  onChange={e => setSplitEnd(e.target.value)}
                  className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-bg-base text-fg-primary"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSplitDialog(false)}
                className="text-sm text-fg-secondary hover:text-fg-primary px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={handleSplit}
                disabled={saving}
                className="bg-accent text-accent-fg text-sm px-4 py-1.5 rounded-lg hover:bg-accent-h"
              >
                {saving ? 'Splitting…' : 'Split'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
