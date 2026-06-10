'use client'

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ────────────────────────────────────────────────────────────────────

interface PageMeta { width: number; height: number; widthPx: number; heightPx: number }

type Tool =
  | 'select' | 'text' | 'sticky' | 'arrow' | 'freehand'
  | 'highlight' | 'underline' | 'strikethrough'
  | 'comment' | 'redact'
  | 'rect' | 'circle' | 'line' | 'stamp' | 'image' | 'crop' | 'link' | 'field'

type FieldType = 'text' | 'checkbox' | 'dropdown' | 'signature'

type DrawPhase =
  | { kind: 'idle' }
  | { kind: 'arrow'; x0: number; y0: number; x1: number; y1: number }
  | { kind: 'freehand'; pts: [number, number][] }
  | { kind: 'text-placing'; x: number; y: number; sticky: boolean }
  | { kind: 'redact-rect'; x0: number; y0: number; x1: number; y1: number }
  | { kind: 'shape-rect'; x0: number; y0: number; x1: number; y1: number; shape: 'rect' | 'circle' | 'line' }
  | { kind: 'crop-rect'; x0: number; y0: number; x1: number; y1: number }
  | { kind: 'image-rect'; x0: number; y0: number; x1: number; y1: number }
  | { kind: 'annot-drag'; pageIndex: number; handle: string; origRect: [number,number,number,number]; startX: number; startY: number; curRect: [number,number,number,number] }
  | { kind: 'link-rect'; x0: number; y0: number; x1: number; y1: number }
  | { kind: 'field-rect'; x0: number; y0: number; x1: number; y1: number }

interface Bookmark { level: number; title: string; page: number }
interface AnnotItem { page: number; pageIndex: number; type: string; rect: [number, number, number, number]; content: string }

interface SelAnnot { pageIndex: number; rect: [number, number, number, number] }

interface RedactRegion {
  id: string; page: number
  ptX0: number; ptY0: number; ptX1: number; ptY1: number
}

interface TextWord { word: string; rect: [number, number, number, number] }

interface CommentReply { id: string; text: string; author: string; timestamp: number }
interface Comment {
  id: string; page: number
  rect?: [number, number, number, number] | null
  text: string; author: string; timestamp: number
  resolved: boolean; replies: CommentReply[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RENDER_SCALE = 1.5
const THUMB_SCALE  = 0.2
const COLORS = ['#000000', '#ef4444', '#3b82f6', '#16a34a', '#f59e0b', '#8b5cf6']
const ZOOM_MIN = 50; const ZOOM_MAX = 300; const ZOOM_STEP = 25
const CANVAS_PAD = 48 // p-6 on each side of scroll container

// ── Helpers ──────────────────────────────────────────────────────────────────

function svgPoint(e: React.MouseEvent<SVGSVGElement>): [number, number] {
  const r = e.currentTarget.getBoundingClientRect()
  return [e.clientX - r.left, e.clientY - r.top]
}

async function apiPost(url: string, body: object) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return r.json()
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)) }

function hitAnnot(sx: number, sy: number, rect: [number,number,number,number], rs: number): boolean {
  const [rx0,ry0,rx1,ry1] = rect.map(v => v * rs)
  return sx >= rx0 - 4 && sx <= rx1 + 4 && sy >= ry0 - 4 && sy <= ry1 + 4
}

const HANDLE_NAMES = ['tl','t','tr','l','r','bl','b','br'] as const
type HandleName = typeof HANDLE_NAMES[number]

function hitHandle(sx: number, sy: number, rect: [number,number,number,number], rs: number): HandleName | null {
  const [rx0,ry0,rx1,ry1] = rect.map(v => v * rs)
  const cx = (rx0+rx1)/2; const cy = (ry0+ry1)/2
  const pts: Record<HandleName,[number,number]> = { tl:[rx0,ry0],t:[cx,ry0],tr:[rx1,ry0],l:[rx0,cy],r:[rx1,cy],bl:[rx0,ry1],b:[cx,ry1],br:[rx1,ry1] }
  for (const name of HANDLE_NAMES) {
    const [hx,hy] = pts[name]
    if (Math.abs(sx-hx) <= 7 && Math.abs(sy-hy) <= 7) return name
  }
  return null
}

function applyDrag(origRect: [number,number,number,number], handle: string, dx: number, dy: number): [number,number,number,number] {
  let [x0,y0,x1,y1] = origRect
  if (handle === 'body') return [x0+dx, y0+dy, x1+dx, y1+dy]
  if (handle.includes('l')) x0 += dx
  if (handle.includes('r')) x1 += dx
  if (handle.includes('t')) y0 += dy
  if (handle.includes('b')) y1 += dy
  return [x0, y0, x1, y1]
}

function handleCursor(h: HandleName): string {
  const map: Record<HandleName,string> = { tl:'nwse-resize',t:'ns-resize',tr:'nesw-resize',l:'ew-resize',r:'ew-resize',bl:'nesw-resize',b:'ns-resize',br:'nwse-resize' }
  return map[h]
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

const ICONS: Record<string, string> = {
  select:        'M5 3l14 9-7 2-3 7z',
  text:          'M4 7V4h16v3M9 20h6M12 4v16',
  sticky:        'M8 2H6a2 2 0 0 0-2 2v14l4-4h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-2M8 2v4M16 2v4',
  arrow:         'M5 12h14M15 6l6 6-6 6',
  freehand:      'M3 17c3-3 5-6 9-6s6 3 9 6',
  highlight:     'M9 7H5m14 0h-5M9 3.5V7m6-3.5V7M4 21h16M6 7v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7',
  underline:     'M6 3v7a6 6 0 0 0 12 0V3M4 21h16',
  strikethrough: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6M12 3v2m0 14v2',
  comment:       'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  undo:          'M3 7v6h6M3 13C5 7.5 9 5 14 5a9 9 0 0 1 7 11c-1.5 4-5 6-8 6',
  rotateCw:      'M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8',
  rotateCcw:     'M3 2v6h6M21 12a9 9 0 0 1-15 6.7L3 16',
  trash:         'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  copy:          'M8 8H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2M10 4h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  merge:         'M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 8v8M9 11l3-3 3 3',
  scissors:      'M6 2v11M6 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 6l12 9M18 6L6 15',
  download:      'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  back:          'M19 12H5M12 5l-7 7 7 7',
  cert:          'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  search:        'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  lock:          'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4',
  stamp:         'M12 3v6m0 0L9 6m3 3l3-3M3 21h18M6 21V10l6-4 6 4v11',
  redact:        'M3 5h18v4H3zM3 12h14M3 16h10',
  chevDown:      'M6 9l6 6 6-6',
  chevLeft:      'M15 18l-6-6 6-6',
  chevRight:     'M9 18l6-6-6-6',
  warn:          'M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  rect:          'M3 3h18v18H3z',
  circle:        'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  line:          'M4 20L20 4',
  image:         'M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zm-10-9a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-4 7l3-3.5 2 2.5 3-3.5 4 4.5H7z',
  crop:          'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14',
  bkmk:          'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  annList:       'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  props:         'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-6v-4m0-4h.01',
  hf:            'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm0 4h16M4 17h16',
  replaceIcon:   'M4 6h16M4 12h16M4 18h10M17 14l2 2 2-2M19 10v6',
  rubber:        'M4 17h16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2zm2-3V8a6 6 0 0 1 12 0v6H6z',
  contView:      'M4 5h16M4 10h16M4 15h16M4 20h16',
  singleView:    'M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  signature:     'M3 17c3-3 4-5 6-5s3 2 5 2 4-4 6-4M3 21h18',
  print:         'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  history:       'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2',
  link:          'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  ocr:           'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h2m2 0h2m2 0h2M7 8h10',
  field:         'M9 12h6M9 8h6M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 9h14',
  fieldCheck:    'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  fieldDrop:     'M4 6h16M4 12h16M4 18h7M15 15l4 4m0-4l-4 4',
  fieldSig:      'M3 17c3-3 4-5 6-5s3 2 5 2 4-4 6-4M3 21h18M17 3l4 4-9.5 9.5L8 18l1.5-3.5z',
  compare:       'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM9 13h6M9 17h6M9 9h1',
}

// ── Toolbar button ───────────────────────────────────────────────────────────

function TBtn({ icon, label, active = false, onClick, disabled = false, title, danger = false }: {
  icon: string; label?: string; active?: boolean; onClick: () => void
  disabled?: boolean; title?: string; danger?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title ?? label}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors select-none
        ${active
          ? danger ? 'bg-danger text-white' : 'bg-accent text-accent-fg'
          : danger ? 'text-danger hover:bg-danger/10' : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-hover'}
        ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <Icon d={ICONS[icon]} />
      {label && <span className="hidden lg:block">{label}</span>}
    </button>
  )
}

function Sep() { return <div className="w-px h-5 bg-border mx-0.5 shrink-0" /> }

// ── Dropdown ─────────────────────────────────────────────────────────────────

function DropItem({ icon, label, onClick, danger }: { icon?: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left flex items-center gap-2.5 px-4 py-2.5 hover:bg-bg-hover text-xs
        ${danger ? 'text-danger' : 'text-fg-secondary hover:text-fg-primary'}`}>
      {icon && <Icon d={ICONS[icon]} size={14} />}
      {label}
    </button>
  )
}

// ── Lazy thumbnail ────────────────────────────────────────────────────────────

function LazyThumb({ src, alt, pw, ph }: { src: string; alt: string; pw: number; ph: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { rootMargin: '300px' })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  if (visible) return <img src={src} alt={alt} className="w-full" draggable={false} />
  return <div ref={ref} className="w-full bg-bg-hover/40 animate-pulse" style={{ aspectRatio: `${pw}/${ph}` }} />
}

// ── Main component ───────────────────────────────────────────────────────────

export function Editor({ jobId }: { jobId: string }) {
  const router = useRouter()
  // Auto-open envelope wizard when ?sign=1 or ?template=<id>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const templateId = params.get('template')

    if (params.get('sign') === '1') {
      autoSignPending.current = true
      const url = new URL(window.location.href)
      url.searchParams.delete('sign')
      window.history.replaceState({}, '', url.toString())
    } else if (templateId) {
      // Load template data, pre-populate wizard, open
      const url = new URL(window.location.href)
      url.searchParams.delete('template')
      window.history.replaceState({}, '', url.toString())

      fetch(`/pdf/api/envelope-templates/${templateId}`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(({ template }) => {
          setEnvTitle(template.name ?? filename.replace(/\.pdf$/i, ''))
          // Build recips with fresh local IDs
          const colors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']
          const rawOrders = (template.recipients ?? []).map((r: Record<string, unknown>, i: number) => (r.order_index as number) ?? i)
          const recips = (template.recipients ?? []).map((r: Record<string, unknown>, i: number) => ({
            id: crypto.randomUUID(),
            name: r.name as string,
            email: r.email as string,
            parallel: i > 0 && rawOrders[i] === rawOrders[i - 1],
            color: (r.color as string) ?? colors[i % colors.length],
          }))
          setEnvRecips(recips)
          // Build fields mapping recipient_index → new recip ID
          const fields = (template.fields ?? []).map((f: Record<string, unknown>) => ({
            id: crypto.randomUUID(),
            recipId: recips[(f.recipient_index as number) ?? 0]?.id ?? recips[0]?.id ?? '',
            page: f.page as number,
            x0: f.x0 as number, y0: f.y0 as number,
            x1: f.x1 as number, y1: f.y1 as number,
            type: (f.field_type as 'signature' | 'initials' | 'date' | 'name') ?? 'signature',
          }))
          setEnvFields(fields)
          if (recips[0]) setEnvActiveRecip(recips[0].id)
          setEnvOpen(true)
          setEnvStep(0)
        })
        .catch(() => {
          // Template load failed — open blank wizard
          setEnvTitle(filename.replace(/\.pdf$/i, ''))
          setEnvOpen(true)
        })
    }
  }, [])

  // Page state
  const [pageCount, setPageCount] = useState(0)
  const [pageInfos, setPageInfos] = useState<PageMeta[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [version, setVersion] = useState(0)
  const [filename, setFilename] = useState('document.pdf')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  // Tool + draw
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState('#000000')
  const [draw, setDraw] = useState<DrawPhase>({ kind: 'idle' })
  const [textVal, setTextVal] = useState('')

  // Zoom
  const [zoom, setZoom] = useState(100)

  // Redaction
  const [redactRegions, setRedactRegions] = useState<RedactRegion[]>([])
  const [redacting, setRedacting] = useState(false)
  const [hasCertificate, setHasCertificate] = useState(false)

  // Text selection (highlight / underline / strikethrough)
  const [textWords, setTextWords] = useState<TextWord[]>([])
  const selAnchorRef = useRef<number | null>(null)
  const selFocusRef  = useRef<number | null>(null)
  const [selRange, setSelRange] = useState<[number, number] | null>(null)

  // Comments
  const [comments, setComments] = useState<Comment[]>([])
  const [commentPanel, setCommentPanel] = useState(false)
  const [commentPlacing, setCommentPlacing] = useState<{ svgX: number; svgY: number; ptX: number; ptY: number } | null>(null)
  const [commentText, setCommentText] = useState('')
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})

  // Watermark modal
  const [watermarkOpen, setWatermarkOpen] = useState(false)
  const [wmText, setWmText]       = useState('CONFIDENTIAL')
  const [wmOpacity, setWmOpacity] = useState(30)
  const [wmColor, setWmColor]     = useState('#aaaaaa')
  const [wmAngle, setWmAngle]     = useState(45)
  const [watermarking, setWatermarking] = useState(false)

  // Password protect modal
  const [protectOpen, setProtectOpen]           = useState(false)
  const [protectPw, setProtectPw]               = useState('')
  const [protectPwConfirm, setProtectPwConfirm] = useState('')
  const [protecting, setProtecting]             = useState(false)

  // Annotation selection (select tool)
  const [pageAnnots, setPageAnnots]     = useState<AnnotItem[]>([])
  const [selectedAnnot, setSelectedAnnot] = useState<SelAnnot | null>(null)
  const [contextMenu, setContextMenu]   = useState<{ x: number; y: number; annotIdx: number } | null>(null)

  // View mode + continuous scroll
  const [viewMode, setViewMode] = useState<'single' | 'continuous'>('single')
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])

  // Bookmarks
  const [bookmarks, setBookmarks]         = useState<Bookmark[]>([])
  const [bookmarkPanel, setBookmarkPanel] = useState(false)
  const [bmAdding, setBmAdding]           = useState(false)
  const [bmNewTitle, setBmNewTitle]       = useState('')

  // Annotation list
  const [allAnnots, setAllAnnots]         = useState<AnnotItem[]>([])
  const [annotListPanel, setAnnotListPanel] = useState(false)
  const [annotListLoading, setAnnotListLoading] = useState(false)

  // Document properties
  const [propsOpen, setPropsOpen]   = useState(false)
  const [propsData, setPropsData]   = useState({ title: '', author: '', subject: '', keywords: '' })
  const [propsSaving, setPropsSaving] = useState(false)

  // Header / Footer
  const [hfOpen, setHfOpen]         = useState(false)
  const [hfHeader, setHfHeader]     = useState('')
  const [hfFooter, setHfFooter]     = useState('')
  const [hfFontSize, setHfFontSize] = useState(10)
  const [hfColor, setHfColor]       = useState('#666666')
  const [hfApplying, setHfApplying] = useState(false)

  // Crop
  const [cropRect, setCropRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)

  // Shape line width
  const [lineWidth, setLineWidth] = useState(1.5)

  // Stamps
  const [pendingStamp, setPendingStamp] = useState('Draft')
  const [stampMenuOpen, setStampMenuOpen] = useState(false)

  // eSignature
  const [sigOpen, setSigOpen]   = useState(false)
  const [sigTab, setSigTab]     = useState<'draw'|'type'|'upload'>('draw')
  const [sigText, setSigText]   = useState('')
  const [sigFont, setSigFont]   = useState('Dancing Script')
  const [sigColor, setSigColor] = useState('#1a1a2e')
  const sigCanvasRef  = useRef<HTMLCanvasElement>(null)
  const sigDrawingRef = useRef(false)

  // Image insertion
  const [imageFile, setImageFile] = useState<File | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Link annotation
  const [linkModalRect, setLinkModalRect] = useState<[number,number,number,number] | null>(null)
  const [linkUri, setLinkUri]             = useState('https://')

  // OCR
  const [ocrOpen, setOcrOpen]       = useState(false)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrLang, setOcrLang]       = useState('eng')

  // PDF comparison
  type DiffChange = { page: number; rect: [number,number,number,number]; kind: 'added'|'removed'; text: string }
  const [diffChanges, setDiffChanges]   = useState<DiffChange[]>([])
  const [diffSummary, setDiffSummary]   = useState<{ total: number; added: number; removed: number } | null>(null)
  const [diffPanel, setDiffPanel]       = useState(false)
  const [comparing, setComparing]       = useState(false)
  const compareInputRef                 = useRef<HTMLInputElement>(null)

  // Form field creation
  const [fieldType, setFieldType]           = useState<FieldType>('text')
  const [fieldDialog, setFieldDialog]       = useState<{ rect: [number,number,number,number] } | null>(null)
  const [fieldName, setFieldName]           = useState('')
  const [fieldChoices, setFieldChoices]     = useState('')
  const [fieldMultiline, setFieldMultiline] = useState(false)
  const [fieldRequired, setFieldRequired]   = useState(false)

  // Find & Replace
  const [replaceOpen, setReplaceOpen]     = useState(false)
  const [replaceFrom, setReplaceFrom]     = useState('')
  const [replaceTo, setReplaceTo]         = useState('')
  const [replacing, setReplacing]         = useState(false)
  const [replaceResult, setReplaceResult] = useState<string | null>(null)

  // Undo history panel
  const [undoPanel, setUndoPanel]   = useState(false)
  const [undoSteps, setUndoSteps]   = useState<{ index: number; ts: number }[]>([])

  // Toolbar dropdowns (fix #1: grouped menus)
  const [pagesMenuOpen, setPagesMenuOpen]       = useState(false)
  const [securityMenuOpen, setSecurityMenuOpen] = useState(false)
  const [exportOpen, setExportOpen]             = useState(false)
  const [exporting, setExporting]               = useState(false)
  const [deletePageConfirm, setDeletePageConfirm] = useState(false)
  const [toastVisible, setToastVisible]           = useState(false)

  // ── Envelope / request-signatures wizard ─────────────────────────────────
  type EnvRecip = { id: string; name: string; email: string; parallel: boolean; color: string }

  // Computes sequential step numbers from array position + parallel flags.
  // Signers with parallel=true share the step number of the signer above them.
  function computeOrders(recips: EnvRecip[]): number[] {
    const orders: number[] = []
    let step = 0
    for (let i = 0; i < recips.length; i++) {
      if (i > 0 && !recips[i].parallel) step++
      orders.push(step)
    }
    return orders
  }
  type EnvField = { id: string; recipId: string; page: number; x0: number; y0: number; x1: number; y1: number; type: 'signature' | 'initials' | 'date' | 'name' }
  const ENV_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']
  const autoSignPending = useRef(false)
  const [envOpen, setEnvOpen]           = useState(false)
  const [envStep, setEnvStep]           = useState(0)   // 0=recipients 1=fields 2=review
  const [envTitle, setEnvTitle]         = useState('')
  const [envRecips, setEnvRecips]       = useState<EnvRecip[]>([])
  const [envFields, setEnvFields]       = useState<EnvField[]>([])
  const [envExpiry, setEnvExpiry]       = useState(14)
  const [envNewName, setEnvNewName]     = useState('')
  const [envNewEmail, setEnvNewEmail]   = useState('')
  const [envActiveRecip, setEnvActiveRecip] = useState<string | null>(null)
  const [envFieldType, setEnvFieldType] = useState<'signature' | 'initials' | 'date' | 'name'>('signature')
  const [envPage, setEnvPage]           = useState(0)
  const [envDragStart, setEnvDragStart] = useState<{ x: number; y: number } | null>(null)
  const [envDragRect, setEnvDragRect]   = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [envSending, setEnvSending]     = useState(false)
  const [envResult, setEnvResult]       = useState<{ id: string; links: { name: string; email: string; url: string }[] } | null>(null)
  const [envCopied, setEnvCopied]       = useState<string | null>(null)
  const envPageRef                      = useRef<HTMLDivElement>(null)
  const [envTmplName, setEnvTmplName]   = useState('')
  const [envTmplSaving, setEnvTmplSaving] = useState(false)
  const [envTmplSaved, setEnvTmplSaved] = useState(false)

  function envReset() {
    setEnvOpen(false); setEnvStep(0); setEnvTitle(filename.replace(/\.pdf$/i, ''))
    setEnvRecips([]); setEnvFields([]); setEnvExpiry(14)
    setEnvNewName(''); setEnvNewEmail(''); setEnvActiveRecip(null)
    setEnvFieldType('signature'); setEnvPage(0); setEnvResult(null)
    setEnvTmplName(''); setEnvTmplSaving(false); setEnvTmplSaved(false)
  }

  async function envSaveTemplate() {
    const name = envTmplName.trim() || envTitle.trim() || filename.replace(/\.pdf$/i, '')
    setEnvTmplSaving(true)
    try {
      const body = {
        name,
        job_id: jobId,
        recipients: envRecips.map((r, i) => ({
          name: r.name, email: r.email, order_index: computeOrders(envRecips)[i],
          required: true, color: r.color,
        })),
        fields: envFields.map(f => {
          const ri = envRecips.findIndex(r => r.id === f.recipId)
          return { recipient_index: ri, page: f.page, x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1,
                   field_type: f.type, required: true }
        }),
      }
      const res = await fetch('/pdf/api/envelope-templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setEnvTmplSaved(true)
      } else {
        const data = await res.json()
        toast(data.error ?? 'Failed to save template')
      }
    } finally {
      setEnvTmplSaving(false)
    }
  }

  function envAddRecip() {
    if (!envNewName.trim() || !envNewEmail.trim()) return
    const id = crypto.randomUUID()
    setEnvRecips(prev => [...prev, {
      id, name: envNewName.trim(), email: envNewEmail.trim(),
      parallel: false, color: ENV_COLORS[prev.length % ENV_COLORS.length],
    }])
    setEnvNewName(''); setEnvNewEmail('')
    setEnvActiveRecip(id)
  }

  function envRemoveRecip(id: string) {
    setEnvRecips(prev => {
      const idx = prev.findIndex(r => r.id === id)
      const next = prev.filter(r => r.id !== id)
      // The signer that slides up to fill the gap should not inherit a parallel relationship
      // with a signer it was never grouped with.
      if (idx < next.length && next[idx].parallel) {
        next[idx] = { ...next[idx], parallel: false }
      }
      return next
    })
    setEnvFields(prev => prev.filter(f => f.recipId !== id))
    setEnvActiveRecip(prev => prev === id ? null : prev)
  }

  function envRemoveField(id: string) {
    setEnvFields(prev => prev.filter(f => f.id !== id))
  }

  function envMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!envActiveRecip) return
    const box = e.currentTarget.getBoundingClientRect()
    setEnvDragStart({ x: e.clientX - box.left, y: e.clientY - box.top })
    setEnvDragRect(null)
    e.preventDefault()
  }

  function envMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!envDragStart) return
    const box = e.currentTarget.getBoundingClientRect()
    const cx = e.clientX - box.left
    const cy = e.clientY - box.top
    setEnvDragRect({
      x: Math.min(envDragStart.x, cx), y: Math.min(envDragStart.y, cy),
      w: Math.abs(cx - envDragStart.x), h: Math.abs(cy - envDragStart.y),
    })
  }

  function envMouseUp(e: React.MouseEvent<HTMLDivElement>) {
    if (!envDragStart || !envDragRect || !envActiveRecip) { setEnvDragStart(null); setEnvDragRect(null); return }
    if (envDragRect.w < 20 || envDragRect.h < 10) { setEnvDragStart(null); setEnvDragRect(null); return }
    const box = e.currentTarget.getBoundingClientRect()
    const info = pageInfos[envPage]
    if (!info) { setEnvDragStart(null); setEnvDragRect(null); return }
    const scaleX = info.width / box.width
    const scaleY = info.height / box.height
    const x0 = envDragRect.x * scaleX
    const y0 = envDragRect.y * scaleY
    const x1 = (envDragRect.x + envDragRect.w) * scaleX
    const y1 = (envDragRect.y + envDragRect.h) * scaleY
    setEnvFields(prev => [...prev, {
      id: crypto.randomUUID(), recipId: envActiveRecip,
      page: envPage, x0, y0, x1, y1, type: envFieldType,
    }])
    setEnvDragStart(null); setEnvDragRect(null)
  }

  async function envSend() {
    if (!envRecips.length || !envFields.length) return
    setEnvSending(true)
    try {
      const body = {
        job_id: jobId,
        title: envTitle.trim() || filename.replace(/\.pdf$/i, ''),
        expiry_days: envExpiry,
        recipients: envRecips.map((r, i) => ({ name: r.name, email: r.email, order_index: computeOrders(envRecips)[i] })),
        fields: envFields.map(f => {
          const ri = envRecips.findIndex(r => r.id === f.recipId)
          return { recipient_index: ri, page: f.page, x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, field_type: f.type }
        }),
      }
      const res = await fetch('/pdf/api/envelopes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error ?? 'Failed to send'); return }
      setEnvResult(data)
    } finally {
      setEnvSending(false)
    }
  }

  // Digital signing
  const [signOpen, setSignOpen]         = useState(false)
  const [signName, setSignName]         = useState('')
  const [signEmail, setSignEmail]       = useState('')
  const [signOrg, setSignOrg]           = useState('')
  const [signReason, setSignReason]     = useState('')
  const [signLocation, setSignLocation] = useState('')
  const [signVisible, setSignVisible]   = useState(true)
  const [signing, setSigning]           = useState(false)
  const [savedCert, setSavedCert]       = useState<{ cert_b64: string; passphrase: string; subject: string; expires: string } | null>(null)

  // Drag-to-reorder
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  // Split dialog
  const [splitDialog, setSplitDialog] = useState(false)
  const [splitStart, setSplitStart]   = useState('1')
  const [splitEnd, setSplitEnd]       = useState('1')

  // Search
  const [searchOpen, setSearchOpen]       = useState(false)
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState<{ page: number; rect: [number, number, number, number] }[]>([])
  const [searchIndex, setSearchIndex]     = useState(0)

  // Refs
  const searchInputRef  = useRef<HTMLInputElement>(null)
  const mergeInputRef   = useRef<HTMLInputElement>(null)
  const textInputRef    = useRef<HTMLInputElement>(null)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const svgRef          = useRef<SVGSVGElement>(null)
  // fix #3: scroll container ref for fit-page / fit-width / wheel zoom
  const containerRef    = useRef<HTMLDivElement>(null)

  const renderScale = zoom * RENDER_SCALE / 100
  const pageInfo    = pageInfos[currentPage]
  const isTextTool  = tool === 'highlight' || tool === 'underline' || tool === 'strikethrough'

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadInfo = useCallback(async () => {
    const [infoRes, metaRes] = await Promise.all([
      fetch(`/pdf/api/pdf/${jobId}/info`),
      fetch(`/pdf/api/pdf/${jobId}/meta`),
    ])
    if (infoRes.ok) {
      const d = await infoRes.json()
      setPageCount(d.pageCount); setPageInfos(d.pages); setSplitEnd(String(d.pageCount))
    }
    if (metaRes.ok) {
      const m = await metaRes.json()
      setFilename(m.filename ?? 'document.pdf')
    }
  }, [jobId])

  const loadComments = useCallback(async () => {
    const res = await fetch(`/pdf/api/pdf/${jobId}/comments`)
    if (res.ok) { const d = await res.json(); setComments(d.comments ?? []) }
  }, [jobId])

  useEffect(() => { loadInfo() }, [loadInfo])
  useEffect(() => {
    if (autoSignPending.current && filename !== 'document.pdf') {
      autoSignPending.current = false
      setEnvTitle(filename.replace(/\.pdf$/i, ''))
      setEnvOpen(true)
    }
  }, [filename])
  useEffect(() => { loadComments() }, [loadComments])

  useEffect(() => {
    fetch(`/pdf/api/pdf/${jobId}/redact`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.available) setHasCertificate(true) })
      .catch(() => {})
  }, [jobId])

  // Load page annotations when select tool active (for hit detection)
  useEffect(() => {
    if (tool !== 'select') { setPageAnnots([]); setSelectedAnnot(null); return }
    fetch(`/pdf/api/pdf/${jobId}/annots`)
      .then(r => r.ok ? r.json() : { annots: [] })
      .then(d => setPageAnnots((d.annots ?? []).filter((a: AnnotItem) => a.page === currentPage)))
      .catch(() => {})
  }, [tool, currentPage, jobId, version])

  // Load word positions when text markup tool is active
  useEffect(() => {
    if (!isTextTool) { setTextWords([]); return }
    fetch(`/pdf/api/pdf/${jobId}/text/${currentPage}`)
      .then(r => r.json())
      .then(d => setTextWords(d.words ?? []))
      .catch(() => {})
  }, [isTextTool, currentPage, jobId, version])

  // Bookmarks — load on mount and after changes
  const loadBookmarks = useCallback(async () => {
    const res = await fetch(`/pdf/api/pdf/${jobId}/bookmarks`)
    if (res.ok) { const d = await res.json(); setBookmarks(d.bookmarks ?? []) }
  }, [jobId])

  useEffect(() => { loadBookmarks() }, [loadBookmarks])

  // Continuous scroll — track active page by scroll position
  useEffect(() => {
    if (viewMode !== 'continuous' || !containerRef.current) return
    const el = containerRef.current
    const handler = () => {
      const cRect = el.getBoundingClientRect()
      let bestIdx = 0; let bestVis = -1
      pageRefs.current.forEach((div, i) => {
        if (!div) return
        const r = div.getBoundingClientRect()
        const vis = Math.min(r.bottom, cRect.bottom) - Math.max(r.top, cRect.top)
        if (vis > bestVis) { bestVis = vis; bestIdx = i }
      })
      setCurrentPage(bestIdx)
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [viewMode, pageCount])

  // Keep pageRefs array sized correctly
  useEffect(() => { pageRefs.current = Array(pageCount).fill(null) }, [pageCount])

  const loadUndoSteps = useCallback(async () => {
    const res = await fetch(`/pdf/api/pdf/${jobId}/undo`)
    if (res.ok) { const d = await res.json(); setUndoSteps(d.steps ?? []) }
  }, [jobId])

  const bump = useCallback(() => {
    setVersion(v => v + 1); loadInfo(); loadComments()
  }, [loadInfo, loadComments])

  function pageUrl(n: number, scale = renderScale) {
    return `/pdf/api/pdf/${jobId}/page/${n}?scale=${scale}&v=${version}`
  }

  function displayW() { return pageInfo ? Math.round(pageInfo.widthPx * zoom / 100) : 0 }
  function displayH() { return pageInfo ? Math.round(pageInfo.heightPx * zoom / 100) : 0 }
  function toast(msg: string) {
    setStatus(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2500)
    setTimeout(() => setStatus(''), 2800)
  }

  // ── Fix #3: scroll-wheel zoom (Ctrl+scroll) ────────────────────────────────

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const dir = e.deltaY > 0 ? -1 : 1
      setZoom(z => clamp(z + dir * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // ── Fix #3: fit-page / fit-width ───────────────────────────────────────────

  function fitPage() {
    if (!pageInfo || !containerRef.current) return
    const cw = containerRef.current.clientWidth  - CANVAS_PAD
    const ch = containerRef.current.clientHeight - CANVAS_PAD
    const zw = (cw / pageInfo.widthPx)  * 100
    const zh = (ch / pageInfo.heightPx) * 100
    setZoom(clamp(Math.min(zw, zh), ZOOM_MIN, ZOOM_MAX))
  }

  function fitWidth() {
    if (!pageInfo || !containerRef.current) return
    const cw = containerRef.current.clientWidth - CANVAS_PAD
    setZoom(clamp((cw / pageInfo.widthPx) * 100, ZOOM_MIN, ZOOM_MAX))
  }

  // ── Undo + keyboard ────────────────────────────────────────────────────────

  const handleUndoRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    handleUndoRef.current = async () => {
      const res = await fetch(`/pdf/api/pdf/${jobId}/undo`, { method: 'POST' })
      if (res.ok) { bump(); toast('Undone') } else toast('Nothing to undo')
    }
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); handleUndoRef.current()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(prev => { if (!prev) setTimeout(() => searchInputRef.current?.focus(), 50); return !prev })
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnot && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault(); deleteAnnot(selectedAnnot.pageIndex)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false); setSearchResults([]); setSearchQuery('')
        setCommentPlacing(null); setProtectOpen(false); setWatermarkOpen(false)
        setPagesMenuOpen(false); setSecurityMenuOpen(false); setExportOpen(false)
        setStampMenuOpen(false); setPropsOpen(false); setHfOpen(false)
        setCropRect(null); if (tool === 'crop') setTool('select')
        setSelectedAnnot(null); setContextMenu(null); setLinkModalRect(null); setFieldDialog(null)
        if (tool === 'field') setTool('select')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Dismiss context menu on any click outside it
  useEffect(() => {
    if (!contextMenu) return
    function dismiss() { setContextMenu(null) }
    document.addEventListener('click', dismiss, { capture: true })
    document.addEventListener('contextmenu', dismiss, { capture: true })
    return () => {
      document.removeEventListener('click', dismiss, { capture: true })
      document.removeEventListener('contextmenu', dismiss, { capture: true })
    }
  }, [contextMenu])

  // ── Search ─────────────────────────────────────────────────────────────────

  async function doSearch(q: string) {
    if (!q.trim()) { setSearchResults([]); setSearchIndex(0); return }
    const res = await fetch(`/pdf/api/pdf/${jobId}/search?q=${encodeURIComponent(q)}`)
    if (!res.ok) return
    const data = await res.json()
    const results: { page: number; rect: [number, number, number, number] }[] = data.results ?? []
    setSearchResults(results); setSearchIndex(0)
    if (results.length > 0) setCurrentPage(results[0].page)
  }

  function searchNav(dir: 1 | -1) {
    if (!searchResults.length) return
    const next = (searchIndex + dir + searchResults.length) % searchResults.length
    setSearchIndex(next); setCurrentPage(searchResults[next].page)
  }

  // ── Text selection ─────────────────────────────────────────────────────────

  async function commitTextSelection() {
    const anchor = selAnchorRef.current; const focus = selFocusRef.current
    selAnchorRef.current = null; selFocusRef.current = null; setSelRange(null)
    if (anchor === null || focus === null) return
    const min = Math.min(anchor, focus); const max = Math.max(anchor, focus)
    const words = textWords.slice(min, max + 1).filter(w => w.word.trim())
    if (!words.length) return
    const annotType = tool === 'underline' ? 'underline' : tool === 'strikethrough' ? 'strikethrough' : 'highlight'
    await apiPost(`/pdf/api/pdf/${jobId}/annotate`, {
      type: annotType, page: currentPage, scale: 1, quads: words.map(w => w.rect), color,
    })
    bump()
  }

  // ── Comments (fix #4: decoupled panel/tool) ────────────────────────────────

  async function submitComment() {
    if (!commentPlacing || !commentText.trim()) return
    const w = 120 / renderScale; const h = 20 / renderScale
    await apiPost(`/pdf/api/pdf/${jobId}/comments`, {
      page: currentPage,
      rect: [commentPlacing.ptX, commentPlacing.ptY, commentPlacing.ptX + w, commentPlacing.ptY + h],
      text: commentText.trim(), author: 'Operator',
    })
    setCommentPlacing(null); setCommentText('')
    setTool('select') // fix #4: auto-return to select after placing
    loadComments(); setCommentPanel(true)
  }

  async function resolveComment(id: string, resolved: boolean) {
    await fetch(`/pdf/api/pdf/${jobId}/comments/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved }),
    })
    loadComments()
  }

  async function deleteComment(id: string) {
    await fetch(`/pdf/api/pdf/${jobId}/comments/${id}`, { method: 'DELETE' })
    loadComments()
  }

  async function addReply(commentId: string) {
    const text = replyTexts[commentId]?.trim()
    if (!text) return
    await apiPost(`/pdf/api/pdf/${jobId}/comments/${commentId}/reply`, { text, author: 'Operator' })
    setReplyTexts(prev => ({ ...prev, [commentId]: '' }))
    loadComments()
  }

  // ── Watermark ──────────────────────────────────────────────────────────────

  async function doWatermark() {
    if (!wmText.trim()) return
    setWatermarking(true)
    await apiPost(`/pdf/api/pdf/${jobId}/watermark`, {
      text: wmText.trim(), opacity: wmOpacity / 100, angle: wmAngle, color: wmColor, pages: 'all',
    })
    setWatermarkOpen(false); bump(); toast('Watermark applied'); setWatermarking(false)
  }

  // ── Password protect ───────────────────────────────────────────────────────

  async function doProtect() {
    if (!protectPw || protectPw !== protectPwConfirm) { toast('Passwords do not match'); return }
    setProtecting(true)
    const res = await fetch(`/pdf/api/pdf/${jobId}/protect`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_pw: protectPw }),
    })
    if (!res.ok) { toast('Protection failed'); setProtecting(false); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${filename.replace(/\.pdf$/i, '')}-protected.pdf`
    a.click(); URL.revokeObjectURL(url)
    setProtectOpen(false); setProtectPw(''); setProtectPwConfirm('')
    toast('Protected PDF downloaded'); setProtecting(false)
  }

  // ── Digital signing ────────────────────────────────────────────────────────

  async function doSign() {
    if (!signName.trim()) { toast('Enter your name'); return }
    setSigning(true)
    try {
      let cert = savedCert
      if (!cert) {
        const genRes = await apiPost('/pdf/api/pdf/sign/generate-cert', {
          name: signName.trim(),
          email: signEmail.trim() || undefined,
          org: signOrg.trim() || undefined,
        })
        if (!genRes.cert_b64) { toast('Certificate generation failed'); setSigning(false); return }
        cert = genRes as { cert_b64: string; passphrase: string; subject: string; expires: string }
        setSavedCert(cert)
      }
      const res = await apiPost(`/pdf/api/pdf/${jobId}/sign`, {
        cert_b64: cert.cert_b64,
        passphrase: cert.passphrase,
        signer_name: signName.trim(),
        reason: signReason.trim() || undefined,
        location: signLocation.trim() || undefined,
        page: currentPage,
        visible: signVisible,
      })
      if (!res.ok) { toast('Signing failed'); setSigning(false); return }
      setSignOpen(false); bump(); toast('PDF signed')
    } catch {
      toast('Signing failed')
    }
    setSigning(false)
  }

  // ── Page operations ────────────────────────────────────────────────────────

  async function rotate(angle: 90 | -90) {
    setSaving(true)
    await apiPost(`/pdf/api/pdf/${jobId}/pages/rotate`, { page: currentPage, angle })
    bump(); setSaving(false); toast('Rotated')
  }

  async function deletePage() {
    if (pageCount <= 1) return
    setDeletePageConfirm(true)
  }

  async function confirmDeletePage() {
    setDeletePageConfirm(false); setSaving(true)
    const next = currentPage > 0 ? currentPage - 1 : 0
    await apiPost(`/pdf/api/pdf/${jobId}/pages/delete`, { page: currentPage })
    setCurrentPage(next); bump(); setSaving(false); toast('Page deleted')
  }

  async function duplicatePage() {
    setSaving(true)
    await apiPost(`/pdf/api/pdf/${jobId}/pages/duplicate`, { page: currentPage })
    bump(); setSaving(false); toast('Page duplicated')
  }

  async function handleReorder(from: number, to: number) {
    if (from === to) return
    const order = Array.from({ length: pageCount }, (_, i) => i)
    order.splice(from, 1); order.splice(to, 0, from)
    setSaving(true)
    await apiPost(`/pdf/api/pdf/${jobId}/pages/reorder`, { order })
    setCurrentPage(to); bump(); setSaving(false); toast('Pages reordered')
  }

  async function handleMerge(file: File) {
    setSaving(true)
    const form = new FormData(); form.append('file', file)
    const res = await fetch(`/pdf/api/pdf/${jobId}/merge`, { method: 'POST', body: form })
    const d = await res.json()
    bump(); setSaving(false); toast(`Merged — ${d.pageCount} pages total`)
  }

  async function handleSplit() {
    const start = parseInt(splitStart) - 1; const end = parseInt(splitEnd) - 1
    if (isNaN(start) || isNaN(end) || start > end || start < 0 || end >= pageCount) {
      toast('Invalid page range'); return
    }
    setSaving(true)
    const d = await apiPost(`/pdf/api/pdf/${jobId}/split`, { start, end })
    setSplitDialog(false); setSaving(false)
    if (d.jobId) { toast('Split created — opening…'); setTimeout(() => router.push(`/pdf/editor/${d.jobId}`), 1000) }
  }

  async function exportAs(format: string, label: string) {
    setExportOpen(false); setExporting(true); toast(`Exporting as ${label}…`)
    try {
      const res = await fetch(`/pdf/api/pdf/${jobId}/convert/export?format=${format}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }))
        toast(err.error ?? 'Export failed'); return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = format === 'pdfa' ? 'pdf' : format === 'png' ? 'zip' : format
      a.download = `${filename.replace(/\.pdf$/i, '')}.${ext}`
      a.click(); URL.revokeObjectURL(url); toast(`${label} downloaded`)
    } finally { setExporting(false) }
  }

  // ── Redaction ──────────────────────────────────────────────────────────────

  async function handleRedact() {
    if (redactRegions.length === 0) return
    setRedacting(true)
    try {
      const res = await fetch(`/pdf/api/pdf/${jobId}/redact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regions: redactRegions.map(r => ({ page: r.page, x0: r.ptX0, y0: r.ptY0, x1: r.ptX1, y1: r.ptY1 })),
          scale: 1, filename, user_id: 'operator', user_name: 'Operator',
        }),
      })
      const d = await res.json()
      if (!res.ok) { toast(d.error ?? 'Redaction failed'); return }
      if (d.jobId) { toast('Redacted — opening…'); setTimeout(() => router.push(`/pdf/editor/${d.jobId}`), 1200) }
    } catch { toast('Redaction failed') }
    finally { setRedacting(false) }
  }

  // ── New handlers ──────────────────────────────────────────────────────────

  function goToPage(n: number) {
    if (viewMode === 'continuous') {
      pageRefs.current[n]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setCurrentPage(n)
  }

  // ── eSignature helpers ─────────────────────────────────────────────────────

  function sigDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const cv = sigCanvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!; const r = cv.getBoundingClientRect()
    sigDrawingRef.current = true
    ctx.strokeStyle = sigColor; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top)
  }
  function sigMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!sigDrawingRef.current || !sigCanvasRef.current) return
    const ctx = sigCanvasRef.current.getContext('2d')!; const r = sigCanvasRef.current.getBoundingClientRect()
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top); ctx.stroke()
  }
  function sigUp() { sigDrawingRef.current = false }
  function sigClear() {
    const cv = sigCanvasRef.current; if (!cv) return
    cv.getContext('2d')!.clearRect(0, 0, cv.width, cv.height)
  }

  async function captureSignature(): Promise<File | null> {
    if (sigTab === 'draw') {
      const cv = sigCanvasRef.current; if (!cv) return null
      return new Promise(res => cv.toBlob(b => res(b ? new File([b], 'sig.png', { type: 'image/png' }) : null), 'image/png'))
    }
    if (sigTab === 'type') {
      if (!sigText.trim()) return null
      const cv = document.createElement('canvas'); cv.width = 420; cv.height = 130
      const ctx = cv.getContext('2d')!
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 420, 130)
      ctx.fillStyle = sigColor; ctx.font = `italic 56px "${sigFont}", cursive`
      ctx.textBaseline = 'middle'; ctx.fillText(sigText, 20, 65)
      return new Promise(res => cv.toBlob(b => res(b ? new File([b], 'sig.png', { type: 'image/png' }) : null), 'image/png'))
    }
    return null
  }

  async function useSignature() {
    const file = await captureSignature(); if (!file) return
    setImageFile(file); setTool('image'); setSigOpen(false)
    toast('Drag on the page to place your signature')
  }

  async function addBookmark() {
    if (!bmNewTitle.trim()) return
    await apiPost(`/pdf/api/pdf/${jobId}/bookmarks`, { title: bmNewTitle.trim(), page: currentPage, level: 1 })
    setBmNewTitle(''); setBmAdding(false); loadBookmarks()
  }

  async function deleteBookmark(idx: number) {
    await fetch(`/pdf/api/pdf/${jobId}/bookmarks/${idx}`, { method: 'DELETE' })
    loadBookmarks()
  }

  async function moveAnnot(pageIndex: number, rect: [number,number,number,number]) {
    await fetch(`/pdf/api/pdf/${jobId}/annotate`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: currentPage, index: pageIndex, rect }),
    })
    bump()
  }

  async function deleteAnnot(pageIndex: number) {
    await fetch(`/pdf/api/pdf/${jobId}/annotate`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: currentPage, index: pageIndex }),
    })
    setSelectedAnnot(null); bump()
  }

  async function loadAllAnnots() {
    setAnnotListLoading(true)
    const res = await fetch(`/pdf/api/pdf/${jobId}/annots`)
    if (res.ok) { const d = await res.json(); setAllAnnots(d.annots ?? []) }
    setAnnotListLoading(false)
  }

  async function openProps() {
    const res = await fetch(`/pdf/api/pdf/${jobId}/props`)
    if (res.ok) { const d = await res.json(); setPropsData({ title: d.title ?? '', author: d.author ?? '', subject: d.subject ?? '', keywords: d.keywords ?? '' }) }
    setPropsOpen(true)
  }

  async function doSaveProps() {
    setPropsSaving(true)
    await apiPost(`/pdf/api/pdf/${jobId}/props`, propsData)
    setPropsSaving(false); setPropsOpen(false); toast('Properties saved')
  }

  async function doHeaderFooter() {
    if (!hfHeader.trim() && !hfFooter.trim()) return
    setHfApplying(true)
    await apiPost(`/pdf/api/pdf/${jobId}/header-footer`, { header: hfHeader, footer: hfFooter, fontSize: hfFontSize, color: hfColor })
    setHfOpen(false); bump(); toast('Header/footer applied'); setHfApplying(false)
  }

  async function doInsertBlank() {
    setSaving(true)
    const d = await apiPost(`/pdf/api/pdf/${jobId}/pages/blank`, { after: currentPage })
    bump(); setSaving(false); toast(`Blank page inserted`)
    if (d.insertedAt !== undefined) setCurrentPage(d.insertedAt)
  }

  async function doInsertImage(x0: number, y0: number, x1: number, y1: number) {
    if (!imageFile) return
    setSaving(true)
    const fd = new FormData()
    fd.append('file', imageFile)
    fd.append('page', String(currentPage))
    fd.append('x0', String(x0)); fd.append('y0', String(y0))
    fd.append('x1', String(x1)); fd.append('y1', String(y1))
    fd.append('scale', String(renderScale))
    await fetch(`/pdf/api/pdf/${jobId}/image`, { method: 'POST', body: fd })
    setImageFile(null); bump(); setSaving(false)
  }

  async function doConfirmCrop() {
    if (!cropRect) return
    setSaving(true)
    await apiPost(`/pdf/api/pdf/${jobId}/crop`, { page: currentPage, scale: renderScale, ...cropRect })
    setCropRect(null); setTool('select'); bump(); setSaving(false); toast('Page cropped')
  }

  async function doReplace() {
    if (!replaceFrom.trim()) return
    setReplacing(true); setReplaceResult(null)
    const d = await apiPost(`/pdf/api/pdf/${jobId}/replace`, { find: replaceFrom, replace: replaceTo })
    setReplacing(false)
    if (d.replaced === 0) { setReplaceResult('No matches found') }
    else { setReplaceResult(`Replaced ${d.replaced} occurrence${d.replaced !== 1 ? 's' : ''}`); bump() }
  }

  async function doCompare(file: File) {
    setComparing(true); setDiffChanges([]); setDiffSummary(null)
    toast('Comparing documents…')
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`/pdf/api/pdf/${jobId}/compare`, { method: 'POST', body: fd })
      if (!res.ok) { toast('Comparison failed'); return }
      const d = await res.json()
      setDiffChanges(d.changes ?? [])
      setDiffSummary(d.summary ?? null)
      setDiffPanel(true)
      toast(`Done — ${d.summary?.total ?? 0} difference${d.summary?.total !== 1 ? 's' : ''} found`)
    } catch { toast('Comparison failed') }
    finally { setComparing(false) }
  }

  async function createField() {
    if (!fieldDialog) return
    const choices = fieldChoices.split('\n').map(s => s.trim()).filter(Boolean)
    await apiPost(`/pdf/api/pdf/${jobId}/fields`, {
      page: currentPage, rect: fieldDialog.rect, type: fieldType,
      name: fieldName.trim() || `field_${Date.now() % 10000}`,
      choices, multiline: fieldMultiline, required: fieldRequired,
    })
    setFieldDialog(null); setTool('select'); bump(); toast('Form field added')
  }

  async function doOcr() {
    setOcrRunning(true); toast('Running OCR — this may take a moment…')
    try {
      const res = await fetch(`/pdf/api/pdf/${jobId}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: ocrLang }),
      })
      const d = await res.json()
      if (!res.ok) { toast(d.error ?? 'OCR failed'); return }
      bump(); toast('OCR complete — document is now searchable')
    } catch { toast('OCR failed') }
    finally { setOcrRunning(false) }
  }

  async function addLink() {
    if (!linkModalRect || !linkUri.startsWith('http')) return
    await apiPost(`/pdf/api/pdf/${jobId}/links`, { page: currentPage, rect: linkModalRect, uri: linkUri })
    setLinkModalRect(null); setTool('select'); bump(); toast('Link added')
  }

  function printPdf() {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = `/pdf/api/pdf/${jobId}/download`
    document.body.appendChild(iframe)
    iframe.onload = () => {
      try { iframe.contentWindow?.print() } catch {}
      setTimeout(() => document.body.removeChild(iframe), 60000)
    }
  }

  async function saveAnnotation(body: object) {
    setSaving(true)
    await apiPost(`/pdf/api/pdf/${jobId}/annotate`, body)
    bump(); setSaving(false)
  }

  // ── SVG interaction ────────────────────────────────────────────────────────

  const toolCursor: Record<Tool, string> = {
    select: 'default', text: 'text', sticky: 'cell',
    arrow: 'crosshair', freehand: 'crosshair', redact: 'crosshair',
    highlight: 'text', underline: 'text', strikethrough: 'text', comment: 'crosshair',
    rect: 'crosshair', circle: 'crosshair', line: 'crosshair',
    stamp: 'copy', image: 'crosshair', crop: 'crosshair', link: 'crosshair', field: 'crosshair',
  }

  function onSvgDown(e: React.MouseEvent<SVGSVGElement>) {
    if (!pageInfo) return
    const [x, y] = svgPoint(e)

    if (tool === 'select') {
      // Check handle of currently selected annotation first
      if (selectedAnnot) {
        const h = hitHandle(x, y, selectedAnnot.rect, renderScale)
        if (h) {
          setDraw({ kind: 'annot-drag', pageIndex: selectedAnnot.pageIndex, handle: h,
            origRect: selectedAnnot.rect, startX: x, startY: y, curRect: selectedAnnot.rect })
          return
        }
        // Check body drag
        if (hitAnnot(x, y, selectedAnnot.rect, renderScale)) {
          setDraw({ kind: 'annot-drag', pageIndex: selectedAnnot.pageIndex, handle: 'body',
            origRect: selectedAnnot.rect, startX: x, startY: y, curRect: selectedAnnot.rect })
          return
        }
      }
      // Hit test all page annotations
      const hit = pageAnnots.find(a => hitAnnot(x, y, a.rect, renderScale))
      if (hit) {
        setSelectedAnnot({ pageIndex: hit.pageIndex, rect: hit.rect })
        setDraw({ kind: 'annot-drag', pageIndex: hit.pageIndex, handle: 'body',
          origRect: hit.rect, startX: x, startY: y, curRect: hit.rect })
      } else {
        setSelectedAnnot(null)
      }
      return
    }
    if (tool === 'text' || tool === 'sticky') {
      setDraw({ kind: 'text-placing', x, y, sticky: tool === 'sticky' })
      setTextVal('')
      setTimeout(() => textInputRef.current?.focus(), 50)
      return
    }
    if (tool === 'arrow')    { setDraw({ kind: 'arrow', x0: x, y0: y, x1: x, y1: y }); return }
    if (tool === 'freehand') { setDraw({ kind: 'freehand', pts: [[x, y]] }); return }
    if (tool === 'redact')   { setDraw({ kind: 'redact-rect', x0: x, y0: y, x1: x, y1: y }); return }
    if (tool === 'rect' || tool === 'circle' || tool === 'line') {
      setDraw({ kind: 'shape-rect', x0: x, y0: y, x1: x, y1: y, shape: tool }); return
    }
    if (tool === 'crop')  { setCropRect(null); setDraw({ kind: 'crop-rect', x0: x, y0: y, x1: x, y1: y }); return }
    if (tool === 'image') { setDraw({ kind: 'image-rect', x0: x, y0: y, x1: x, y1: y }); return }
    if (tool === 'link')  { setDraw({ kind: 'link-rect',  x0: x, y0: y, x1: x, y1: y }); return }
    if (tool === 'field') { setDraw({ kind: 'field-rect', x0: x, y0: y, x1: x, y1: y }); return }
    if (tool === 'stamp') {
      const ptX = x / renderScale; const ptY = y / renderScale
      const w = 150; const h = 60
      saveAnnotation({ type: 'stamp', page: currentPage, scale: 1, stamp: pendingStamp,
        rect: [ptX - w / 2, ptY - h / 2, ptX + w / 2, ptY + h / 2] })
      return
    }
    if (tool === 'comment') {
      setCommentPlacing({ svgX: x, svgY: y, ptX: x / renderScale, ptY: y / renderScale })
      setTimeout(() => commentInputRef.current?.focus(), 50)
      return
    }
  }

  function onSvgMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!pageInfo) return
    const [x, y] = svgPoint(e)
    if (draw.kind === 'arrow')            setDraw({ ...draw, x1: x, y1: y })
    else if (draw.kind === 'freehand')    setDraw({ kind: 'freehand', pts: [...draw.pts, [x, y]] })
    else if (draw.kind === 'redact-rect') setDraw({ ...draw, x1: x, y1: y })
    else if (draw.kind === 'shape-rect')  setDraw({ ...draw, x1: x, y1: y })
    else if (draw.kind === 'crop-rect')   setDraw({ ...draw, x1: x, y1: y })
    else if (draw.kind === 'image-rect')  setDraw({ ...draw, x1: x, y1: y })
    else if (draw.kind === 'link-rect')   setDraw({ ...draw, x1: x, y1: y })
    else if (draw.kind === 'field-rect')  setDraw({ ...draw, x1: x, y1: y })
    else if (draw.kind === 'annot-drag') {
      const dx = (x - draw.startX) / renderScale
      const dy = (y - draw.startY) / renderScale
      const cur = applyDrag(draw.origRect, draw.handle, dx, dy)
      setDraw({ ...draw, curRect: cur })
      setSelectedAnnot(prev => prev ? { ...prev, rect: cur } : null)
    }
  }

  async function onSvgUp() {
    if (isTextTool) { await commitTextSelection(); return }
    if (!pageInfo || draw.kind === 'idle' || draw.kind === 'text-placing') return
    if (draw.kind === 'annot-drag') {
      const r = draw.curRect
      const norm: [number,number,number,number] = [Math.min(r[0],r[2]),Math.min(r[1],r[3]),Math.max(r[0],r[2]),Math.max(r[1],r[3])]
      if (norm[2]-norm[0] > 2 && norm[3]-norm[1] > 2) {
        await moveAnnot(draw.pageIndex, norm)
        setSelectedAnnot({ pageIndex: draw.pageIndex, rect: norm })
      }
      setDraw({ kind: 'idle' }); return
    }
    if (draw.kind === 'redact-rect') {
      if (Math.abs(draw.x1 - draw.x0) > 8 && Math.abs(draw.y1 - draw.y0) > 8) {
        setRedactRegions(prev => [...prev, {
          id: crypto.randomUUID(), page: currentPage,
          ptX0: Math.min(draw.x0, draw.x1) / renderScale, ptY0: Math.min(draw.y0, draw.y1) / renderScale,
          ptX1: Math.max(draw.x0, draw.x1) / renderScale, ptY1: Math.max(draw.y0, draw.y1) / renderScale,
        }])
      }
      setDraw({ kind: 'idle' }); return
    }
    if (draw.kind === 'arrow') {
      const dx = draw.x1 - draw.x0; const dy = draw.y1 - draw.y0
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        await saveAnnotation({ type: 'arrow', page: currentPage, scale: renderScale, color, p1: [draw.x0, draw.y0], p2: [draw.x1, draw.y1] })
      }
    }
    if (draw.kind === 'freehand' && draw.pts.length >= 2) {
      await saveAnnotation({ type: 'freehand', page: currentPage, scale: renderScale, color, inkList: draw.pts })
    }
    if (draw.kind === 'shape-rect') {
      const w = Math.abs(draw.x1 - draw.x0); const h = Math.abs(draw.y1 - draw.y0)
      if (w > 4 && h > 4) {
        const shape = draw.shape
        if (shape === 'line') {
          await saveAnnotation({ type: 'line', page: currentPage, scale: renderScale, color, lineWidth,
            p1: [draw.x0, draw.y0], p2: [draw.x1, draw.y1] })
        } else {
          const rect = [Math.min(draw.x0,draw.x1), Math.min(draw.y0,draw.y1), Math.max(draw.x0,draw.x1), Math.max(draw.y0,draw.y1)]
          await saveAnnotation({ type: shape, page: currentPage, scale: renderScale, color, lineWidth, rect })
        }
      }
    }
    if (draw.kind === 'crop-rect') {
      const w = Math.abs(draw.x1 - draw.x0); const h = Math.abs(draw.y1 - draw.y0)
      if (w > 20 && h > 20) {
        setCropRect({ x0: Math.min(draw.x0,draw.x1), y0: Math.min(draw.y0,draw.y1),
                      x1: Math.max(draw.x0,draw.x1), y1: Math.max(draw.y0,draw.y1) })
      }
      setDraw({ kind: 'idle' }); return
    }
    if (draw.kind === 'image-rect') {
      const w = Math.abs(draw.x1 - draw.x0); const h = Math.abs(draw.y1 - draw.y0)
      if (w > 10 && h > 10) {
        await doInsertImage(Math.min(draw.x0,draw.x1), Math.min(draw.y0,draw.y1),
                            Math.max(draw.x0,draw.x1), Math.max(draw.y0,draw.y1))
      }
      setDraw({ kind: 'idle' }); return
    }
    if (draw.kind === 'field-rect') {
      const w = Math.abs(draw.x1 - draw.x0); const h = Math.abs(draw.y1 - draw.y0)
      if (w > 8 && h > 8) {
        const r: [number,number,number,number] = [
          Math.min(draw.x0,draw.x1)/renderScale, Math.min(draw.y0,draw.y1)/renderScale,
          Math.max(draw.x0,draw.x1)/renderScale, Math.max(draw.y0,draw.y1)/renderScale,
        ]
        setFieldDialog({ rect: r })
        setFieldName(`field_${Date.now() % 10000}`)
        setFieldChoices('Option 1\nOption 2\nOption 3')
        setFieldMultiline(false); setFieldRequired(false)
      }
      setDraw({ kind: 'idle' }); return
    }
    if (draw.kind === 'link-rect') {
      const w = Math.abs(draw.x1 - draw.x0); const h = Math.abs(draw.y1 - draw.y0)
      if (w > 8 && h > 8) {
        const r: [number,number,number,number] = [
          Math.min(draw.x0,draw.x1)/renderScale, Math.min(draw.y0,draw.y1)/renderScale,
          Math.max(draw.x0,draw.x1)/renderScale, Math.max(draw.y0,draw.y1)/renderScale,
        ]
        setLinkModalRect(r); setLinkUri('https://')
      }
      setDraw({ kind: 'idle' }); return
    }
    setDraw({ kind: 'idle' })
  }

  function onSvgContextMenu(e: React.MouseEvent<SVGSVGElement>) {
    if (tool !== 'select') return
    e.preventDefault()
    const [sx, sy] = svgPoint(e)
    const hit = pageAnnots.find(a => hitAnnot(sx, sy, a.rect, renderScale))
    if (hit) {
      setSelectedAnnot({ pageIndex: hit.pageIndex, rect: hit.rect })
      setContextMenu({ x: e.clientX, y: e.clientY, annotIdx: hit.pageIndex })
    }
  }

  async function commitText() {
    if (draw.kind !== 'text-placing' || !textVal.trim()) { setDraw({ kind: 'idle' }); return }
    const { x, y, sticky } = draw
    const W = Math.max(textVal.length * 7 + 8, 120); const H = 28
    await saveAnnotation({
      type: sticky ? 'sticky' : 'textbox', page: currentPage, scale: renderScale, color,
      rect: [x, y, x + W, y + H], content: textVal.trim(), fontSize: 12,
    })
    setDraw({ kind: 'idle' }); setTextVal('')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (pageCount === 0 && pageInfos.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-fg-tertiary text-sm">Loading…</div>
  }

  const dw = displayW(); const dh = displayH()
  const pageComments = comments.filter(c => c.page === currentPage)
  const openComments = comments.filter(c => !c.resolved).length

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* ── App bar (row 1): navigation + output actions ──────────────────── */}
      <div className="h-10 bg-bg-raised border-b border-border flex items-center px-2 gap-0.5 shrink-0">
        <button onClick={() => router.push('/pdf')}
          className="flex items-center gap-1 text-xs text-fg-tertiary hover:text-fg-primary mr-1 px-1.5 py-1.5 rounded hover:bg-bg-hover shrink-0">
          <Icon d={ICONS.back} size={14} />
          <span className="hidden sm:block">Files</span>
        </button>
        <span className="text-xs text-fg-secondary truncate max-w-[160px] shrink-0">{filename}</span>
        {saving    && <span className="text-xs text-fg-tertiary ml-1 shrink-0 animate-pulse">Saving…</span>}
        {exporting && <span className="text-xs text-fg-tertiary ml-1 shrink-0 animate-pulse">Converting…</span>}

        <div className="flex-1" />

        {/* Zoom */}
        <button onClick={() => setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP))} title="Zoom out"
          className="w-6 h-6 flex items-center justify-center rounded text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover text-sm shrink-0">−</button>
        <button onClick={() => setZoom(100)} title="Reset to 100%"
          className="text-xs text-fg-tertiary hover:text-fg-primary tabular-nums w-9 text-center shrink-0">{zoom}%</button>
        <button onClick={() => setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP))} title="Zoom in"
          className="w-6 h-6 flex items-center justify-center rounded text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover text-sm shrink-0">+</button>
        <button onClick={fitWidth} title="Fit width"
          className="px-1.5 py-1 rounded text-[10px] text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover shrink-0">W</button>
        <button onClick={fitPage} title="Fit page"
          className="px-1.5 py-1 rounded text-[10px] text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover shrink-0">P</button>

        <Sep />

        {/* View + panels */}
        <TBtn icon={viewMode === 'single' ? 'contView' : 'singleView'}
          title={viewMode === 'single' ? 'Continuous scroll' : 'Single page'}
          onClick={() => setViewMode(v => v === 'single' ? 'continuous' : 'single')} />
        <TBtn icon="bkmk"    active={bookmarkPanel}  title="Bookmarks"
          onClick={() => setBookmarkPanel(p => !p)} />
        <TBtn icon="annList" active={annotListPanel}  title="Annotations"
          onClick={() => { setAnnotListPanel(p => { if (!p) loadAllAnnots(); return !p }) }} />
        <div className="relative shrink-0">
          <button onClick={() => setCommentPanel(p => !p)} title="Comments"
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors
              ${commentPanel ? 'bg-accent text-accent-fg' : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-hover'}`}>
            <Icon d={ICONS.comment} />
          </button>
          {openComments > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-accent-fg text-[9px] font-bold rounded-full flex items-center justify-center pointer-events-none">
              {openComments}
            </span>
          )}
        </div>

        <Sep />

        {/* Output */}
        <a href={`/pdf/forms/${jobId}`} title="Forms"
          className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-fg-secondary hover:text-fg-primary hover:bg-bg-hover shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
               strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          <span className="hidden lg:block">Forms</span>
        </a>
        <button onClick={() => compareInputRef.current?.click()} disabled={comparing} title="Compare with another PDF"
          className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0
            ${diffChanges.length > 0 ? 'text-accent hover:bg-accent/10' : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-hover'}
            disabled:opacity-40 disabled:pointer-events-none`}>
          <Icon d={ICONS.compare} />
          <span className="hidden xl:block">{comparing ? 'Comparing…' : 'Compare'}</span>
        </button>
        <input ref={compareInputRef} type="file" accept=".pdf" className="hidden"
          onChange={e => { if (e.target.files?.[0]) { doCompare(e.target.files[0]); e.target.value = '' } }} />
        {/* Request signatures */}
        <button
          onClick={() => { setEnvTitle(filename.replace(/\.pdf$/i, '')); setEnvOpen(true) }}
          title="Request signatures"
          className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold text-accent hover:bg-accent/10 shrink-0 border border-accent/30">
          <Icon d={ICONS.fieldSig} />
          <span className="hidden xl:block">Send for signing</span>
        </button>
        <Sep />
        <a href={`/pdf/api/pdf/${jobId}/download`} title="Download PDF"
          className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-fg-secondary hover:text-fg-primary hover:bg-bg-hover shrink-0">
          <Icon d={ICONS.download} />
          <span className="hidden xl:block">Download</span>
        </a>
        <button onClick={printPdf} title="Print PDF"
          className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-fg-secondary hover:text-fg-primary hover:bg-bg-hover shrink-0">
          <Icon d={ICONS.print} />
        </button>
        <div className="relative shrink-0">
          <button onClick={() => { setExportOpen(o => !o); setPagesMenuOpen(false); setSecurityMenuOpen(false) }}
            disabled={exporting}
            className="flex items-center gap-0.5 px-2 py-1.5 rounded-md text-xs font-medium text-fg-secondary hover:text-fg-primary hover:bg-bg-hover disabled:opacity-40 disabled:pointer-events-none">
            <span className="hidden lg:block">Export</span>
            <span className="lg:hidden"><Icon d={ICONS.download} size={14} /></span>
            <Icon d={ICONS.chevDown} size={12} />
          </button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-border bg-bg-raised shadow-lg overflow-hidden">
                {([
                  ['docx', 'Word (.docx)'], ['xlsx', 'Excel (.xlsx)'], ['pptx', 'PowerPoint (.pptx)'],
                  ['png', 'PNG pages (ZIP)'], ['pdfa', 'PDF/A (archival)'],
                ] as [string, string][]).map(([fmt, label]) => (
                  <button key={fmt} onClick={() => { setExportOpen(false); exportAs(fmt, label) }}
                    className="w-full text-left px-4 py-2.5 hover:bg-bg-hover text-xs text-fg-secondary hover:text-fg-primary">
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Tool bar (row 2): editing tools ──────────────────────────────── */}
      <div className="h-9 bg-bg-surface border-b border-border flex items-center px-2 gap-0.5 shrink-0 overflow-x-auto">

        {/* History + Find */}
        <TBtn icon="undo"    onClick={() => handleUndoRef.current()} title="Undo (Ctrl+Z)" />
        <TBtn icon="history" active={undoPanel} title="Undo history"
          onClick={() => { setUndoPanel(p => { if (!p) loadUndoSteps(); return !p }) }} />
        <TBtn icon="search"  active={searchOpen}
          onClick={() => { setSearchOpen(o => !o); setTimeout(() => searchInputRef.current?.focus(), 50) }}
          title="Find in document (Ctrl+F)" />

        <Sep />

        {/* Annotation tools */}
        {(['select', 'text', 'sticky', 'arrow', 'freehand'] as Tool[]).map(t => (
          <TBtn key={t} icon={t} active={tool === t}
            title={t.charAt(0).toUpperCase() + t.slice(1)}
            onClick={() => { setTool(t); setDraw({ kind: 'idle' }); setSelRange(null) }} />
        ))}

        <Sep />

        {/* Text markup */}
        {(['highlight', 'underline', 'strikethrough'] as Tool[]).map(t => (
          <TBtn key={t} icon={t} active={tool === t}
            title={t.charAt(0).toUpperCase() + t.slice(1)}
            onClick={() => { setTool(t); setDraw({ kind: 'idle' }); setSelRange(null) }} />
        ))}

        <Sep />

        {/* Shape + insert tools */}
        {(['rect', 'circle', 'line'] as Tool[]).map(t => (
          <TBtn key={t} icon={t} active={tool === t} title={t.charAt(0).toUpperCase() + t.slice(1)}
            onClick={() => { setTool(t); setDraw({ kind: 'idle' }) }} />
        ))}
        <TBtn icon="link"  active={tool === 'link'}  title="Insert hyperlink — drag to set area"
          onClick={() => { setTool('link'); setDraw({ kind: 'idle' }) }} />
        <TBtn icon="field" active={tool === 'field'} title="Add form field — drag to place"
          onClick={() => { setTool('field'); setDraw({ kind: 'idle' }) }} />

        {/* Stamps */}
        <div className="relative shrink-0">
          <button onClick={() => { setStampMenuOpen(o => !o); setPagesMenuOpen(false); setSecurityMenuOpen(false); setExportOpen(false) }}
            className={`flex items-center gap-0.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors
              ${tool === 'stamp' ? 'bg-accent text-accent-fg' : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-hover'}`}>
            <Icon d={ICONS.rubber} />
            <Icon d={ICONS.chevDown} size={10} />
          </button>
          {stampMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setStampMenuOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-xl border border-border bg-bg-raised shadow-lg overflow-hidden py-1">
                {['Approved','Draft','Confidential','For Comment','For Public Release','Not Approved','Top Secret','Expired','Final'].map(s => (
                  <button key={s} onClick={() => { setPendingStamp(s); setTool('stamp'); setStampMenuOpen(false) }}
                    className={`w-full text-left px-4 py-2 text-xs hover:bg-bg-hover ${pendingStamp === s && tool === 'stamp' ? 'text-accent font-semibold' : 'text-fg-secondary'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <TBtn icon="image" active={tool === 'image'} title="Insert image — drag to place"
          onClick={() => { imageInputRef.current?.click() }} />
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { if (e.target.files?.[0]) { setImageFile(e.target.files[0]); setTool('image'); e.target.value = '' } }} />
        <TBtn icon="signature" title="Add signature" onClick={() => { setSigOpen(true); setSigTab('draw') }} />

        <Sep />

        {/* Color + line width */}
        <div className="flex gap-0.5 mx-0.5">
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} title={c}
              className={`w-4 h-4 rounded-full border-2 transition-transform
                ${color === c ? 'border-fg-primary scale-110' : 'border-transparent'}`}
              style={{ background: c }} />
          ))}
        </div>
        <div className="flex gap-0.5 ml-1 shrink-0">
          {([1, 2, 4] as const).map(w => (
            <button key={w} onClick={() => setLineWidth(w)} title={`Line width ${w}px`}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums transition-colors
                ${lineWidth === w ? 'bg-accent text-accent-fg' : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover'}`}>
              {w}px
            </button>
          ))}
        </div>

        <Sep />

        {/* Page ops */}
        <TBtn icon="rotateCcw" onClick={() => rotate(-90)} title="Rotate left" />
        <TBtn icon="rotateCw"  onClick={() => rotate(90)}  title="Rotate right" />
        <TBtn icon="copy"      onClick={duplicatePage}      title="Duplicate page" />
        <TBtn icon="trash"     onClick={deletePage} disabled={pageCount <= 1} title="Delete page" danger />

        <div className="relative shrink-0">
          <button onClick={() => { setPagesMenuOpen(o => !o); setSecurityMenuOpen(false); setExportOpen(false) }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-fg-secondary hover:text-fg-primary hover:bg-bg-hover">
            Pages <Icon d={ICONS.chevDown} size={11} />
          </button>
          {pagesMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPagesMenuOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-xl border border-border bg-bg-raised shadow-lg overflow-hidden">
                <DropItem icon="merge"    label="Merge PDF…"       onClick={() => { setPagesMenuOpen(false); mergeInputRef.current?.click() }} />
                <DropItem icon="scissors" label="Split PDF…"        onClick={() => { setPagesMenuOpen(false); setSplitStart('1'); setSplitEnd(String(pageCount)); setSplitDialog(true) }} />
                <DropItem icon="copy"     label="Insert blank page" onClick={() => { setPagesMenuOpen(false); doInsertBlank() }} />
                <DropItem icon="hf"       label="Header &amp; Footer…" onClick={() => { setPagesMenuOpen(false); setHfOpen(true) }} />
                <DropItem icon="crop"     label="Crop page"         onClick={() => { setPagesMenuOpen(false); setTool('crop'); setCropRect(null) }} />
                <DropItem icon="ocr"      label="Make searchable…"  onClick={() => { setPagesMenuOpen(false); setOcrOpen(true) }} />
              </div>
            </>
          )}
        </div>
        <input ref={mergeInputRef} type="file" accept=".pdf" className="hidden"
          onChange={e => { if (e.target.files?.[0]) { handleMerge(e.target.files[0]); e.target.value = '' } }} />

        <Sep />

        {/* Security */}
        <div className="relative shrink-0">
          <button onClick={() => { setSecurityMenuOpen(o => !o); setPagesMenuOpen(false); setExportOpen(false) }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-fg-secondary hover:text-fg-primary hover:bg-bg-hover">
            Security <Icon d={ICONS.chevDown} size={11} />
          </button>
          {securityMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSecurityMenuOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-xl border border-border bg-bg-raised shadow-lg overflow-hidden">
                <DropItem icon="fieldSig" label="Sign PDF…"              onClick={() => { setSecurityMenuOpen(false); setSignOpen(true) }} />
                <DropItem icon="stamp" label="Add watermark…"         onClick={() => { setSecurityMenuOpen(false); setWatermarkOpen(true) }} />
                <DropItem icon="lock"  label="Password protect…"      onClick={() => { setSecurityMenuOpen(false); setProtectOpen(true) }} />
                <DropItem icon="props" label="Document properties…"   onClick={() => { setSecurityMenuOpen(false); openProps() }} />
                {hasCertificate && (
                  <a href={`/pdf/api/pdf/${jobId}/redact/certificate`} download
                    onClick={() => setSecurityMenuOpen(false)}
                    className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 hover:bg-bg-hover text-xs text-fg-secondary hover:text-fg-primary">
                    <Icon d={ICONS.cert} size={14} />
                    Download certificate
                  </a>
                )}
              </div>
            </>
          )}
        </div>

        <Sep />

        {/* Redact */}
        <TBtn icon="redact" label="Redact" danger active={tool === 'redact'}
          onClick={() => { setTool(tool === 'redact' ? 'select' : 'redact'); setDraw({ kind: 'idle' }) }}
          title="Redact — permanently remove content" />
      </div>

      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      {searchOpen && (
        <div className="h-10 bg-bg-raised border-b border-border px-3 flex items-center gap-2 shrink-0">
          <input ref={searchInputRef} type="text" value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setReplaceFrom(e.target.value) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); doSearch(searchQuery) }
              if (e.key === 'Escape') { setSearchOpen(false); setSearchResults([]); setSearchQuery('') }
              if (e.key === 'ArrowUp')   { e.preventDefault(); searchNav(-1) }
              if (e.key === 'ArrowDown') { e.preventDefault(); searchNav(1) }
            }}
            placeholder="Find in document…"
            className="w-52 border border-border rounded-md px-2.5 py-1 text-xs bg-bg-base text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent" />
          <button onClick={() => doSearch(searchQuery)}
            className="text-xs px-2.5 py-1 border border-border rounded-md text-fg-secondary hover:text-fg-primary hover:bg-bg-hover">Find</button>
          {searchResults.length > 0 && (
            <>
              <span className="text-xs text-fg-tertiary tabular-nums">{searchIndex + 1} / {searchResults.length}</span>
              <button onClick={() => searchNav(-1)} className="w-5 h-5 flex items-center justify-center text-fg-secondary hover:text-fg-primary rounded hover:bg-bg-hover text-xs">↑</button>
              <button onClick={() => searchNav(1)}  className="w-5 h-5 flex items-center justify-center text-fg-secondary hover:text-fg-primary rounded hover:bg-bg-hover text-xs">↓</button>
            </>
          )}
          {searchQuery.trim() && searchResults.length === 0 && <span className="text-xs text-fg-tertiary">No results</span>}
          <button onClick={() => { setReplaceOpen(o => !o); setReplaceResult(null) }}
            className={`text-xs px-2 py-0.5 rounded ml-1 ${replaceOpen ? 'bg-accent text-accent-fg' : 'text-fg-tertiary hover:text-fg-primary'}`}>
            Replace
          </button>
          <button onClick={() => { setSearchOpen(false); setSearchResults([]); setSearchQuery(''); setReplaceOpen(false) }}
            className="ml-auto text-fg-tertiary hover:text-fg-primary text-base leading-none">×</button>
        </div>
      )}
      {searchOpen && replaceOpen && (
        <div className="h-10 bg-bg-raised border-b border-border px-3 flex items-center gap-2 shrink-0">
          <span className="text-xs text-fg-tertiary w-16 shrink-0">Replace:</span>
          <input type="text" value={replaceTo} onChange={e => { setReplaceTo(e.target.value); setReplaceResult(null) }}
            onKeyDown={e => { if (e.key === 'Enter') doReplace() }}
            placeholder="Replace with…"
            className="w-52 border border-border rounded-md px-2.5 py-1 text-xs bg-bg-base text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent" />
          <button onClick={doReplace} disabled={replacing || !replaceFrom.trim()}
            className="text-xs px-2.5 py-1 border border-border rounded-md text-fg-secondary hover:text-fg-primary hover:bg-bg-hover disabled:opacity-40">
            {replacing ? 'Replacing…' : 'Replace all'}
          </button>
          {replaceResult && <span className={`text-xs ${replaceResult.startsWith('No') ? 'text-fg-tertiary' : 'text-accent'}`}>{replaceResult}</span>}
        </div>
      )}

      {/* ── Crop confirmation bar ───────────────────────────────────────────── */}
      {tool === 'crop' && (
        <div className="h-9 border-b border-border flex items-center px-3 gap-3 shrink-0 text-xs"
             style={{ background: 'rgba(99,102,241,0.07)' }}>
          <Icon d={ICONS.crop} size={13} />
          {cropRect
            ? <><span className="text-fg-secondary">Crop region selected for page {currentPage + 1}</span>
                <button onClick={doConfirmCrop} disabled={saving}
                  className="px-3 py-1 bg-accent text-accent-fg rounded-md hover:bg-accent-h disabled:opacity-40">
                  Apply crop
                </button>
                <button onClick={() => setCropRect(null)} className="text-fg-tertiary hover:text-fg-primary">Clear</button></>
            : <span className="text-fg-tertiary">Drag a rectangle to set the crop area for page {currentPage + 1}</span>}
          <button onClick={() => { setTool('select'); setCropRect(null) }} className="ml-auto text-fg-tertiary hover:text-fg-primary">Cancel</button>
        </div>
      )}

      {/* ── Form field type bar ─────────────────────────────────────────────── */}
      {tool === 'field' && (
        <div className="h-9 border-b border-border flex items-center px-3 gap-3 shrink-0 text-xs"
             style={{ background: 'rgba(139,92,246,0.07)' }}>
          <Icon d={ICONS.field} size={13} />
          <span className="text-fg-tertiary">Field type:</span>
          {([['text','Text'],['checkbox','Checkbox'],['dropdown','Dropdown'],['signature','Signature']] as [FieldType,string][]).map(([ft, label]) => (
            <button key={ft} onClick={() => setFieldType(ft)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors
                ${fieldType === ft ? 'bg-accent text-accent-fg border-accent' : 'border-border text-fg-secondary hover:text-fg-primary hover:bg-bg-hover'}`}>
              {label}
            </button>
          ))}
          <span className="text-fg-tertiary ml-2">Drag to place on page</span>
          <button onClick={() => setTool('select')} className="ml-auto text-fg-tertiary hover:text-fg-primary">Cancel</button>
        </div>
      )}

      {/* ── Fix #7: text markup hint bar ────────────────────────────────────── */}
      {isTextTool && (
        <div className="h-7 border-b border-border flex items-center px-3 gap-2 shrink-0 text-xs text-fg-secondary"
             style={{ background: 'rgba(251,191,36,0.08)' }}>
          <Icon d={ICONS.warn} size={12} />
          Drag over words to {tool === 'highlight' ? 'highlight' : tool === 'underline' ? 'underline' : 'apply strikethrough'}
          &nbsp;·&nbsp;release to apply
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Thumbnail strip */}
        <div className="w-[148px] bg-bg-surface border-r border-border flex flex-col shrink-0 overflow-y-auto py-2 gap-1">
          {Array.from({ length: pageCount }, (_, i) => {
            const pi           = pageInfos[i]
            const isDragTarget = dragOver === i && dragFrom !== null && dragFrom !== i
            const hasRedact    = redactRegions.some(r => r.page === i)
            const hasComment   = comments.some(c => c.page === i && !c.resolved)
            return (
              <div key={i} draggable
                onDragStart={() => setDragFrom(i)}
                onDragOver={e => { e.preventDefault(); setDragOver(i) }}
                onDrop={() => { handleReorder(dragFrom!, i); setDragFrom(null); setDragOver(null) }}
                onDragEnd={() => { setDragFrom(null); setDragOver(null) }}
                onClick={() => goToPage(i)}
                className={`mx-2 rounded-md border cursor-pointer overflow-hidden select-none transition-all relative
                  ${currentPage === i ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-accent/40'}
                  ${isDragTarget ? 'ring-2 ring-accent/60 scale-95' : ''}
                  ${dragFrom === i ? 'opacity-40' : ''}`}>
                <LazyThumb src={pageUrl(i, THUMB_SCALE)} alt={`Page ${i + 1}`}
                  pw={pi?.widthPx ?? 210} ph={pi?.heightPx ?? 297} />
                {hasRedact  && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger" />}
                {hasComment && <div className="absolute top-1 left-1  w-2 h-2 rounded-full bg-amber-400" />}
                <div className={`text-center text-[10px] py-0.5 ${currentPage === i ? 'text-accent font-semibold' : 'text-fg-tertiary'}`}>{i + 1}</div>
              </div>
            )
          })}
        </div>

        {/* Bookmarks panel */}
        {bookmarkPanel && (
          <div className="w-[210px] bg-bg-surface border-r border-border flex flex-col shrink-0">
            <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
              <span className="text-xs font-semibold text-fg-primary flex-1">Bookmarks</span>
              <button onClick={() => setBmAdding(a => !a)} className="text-[10px] text-accent hover:underline">+ Add</button>
              <button onClick={() => setBookmarkPanel(false)} className="text-fg-tertiary hover:text-fg-primary text-base leading-none">×</button>
            </div>
            {bmAdding && (
              <div className="px-2 py-2 border-b border-border flex gap-1">
                <input autoFocus value={bmNewTitle} onChange={e => setBmNewTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addBookmark(); if (e.key === 'Escape') setBmAdding(false) }}
                  placeholder={`Page ${currentPage + 1} title…`}
                  className="flex-1 border border-border rounded px-2 py-1 text-xs bg-bg-base text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent" />
                <button onClick={addBookmark} className="text-xs px-2 bg-accent text-accent-fg rounded hover:bg-accent-h">Add</button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {bookmarks.length === 0
                ? <p className="text-xs text-fg-tertiary px-3 py-6 text-center">No bookmarks yet.<br />Click <strong>+ Add</strong> to create one.</p>
                : bookmarks.map((bm, idx) => (
                    <div key={idx} className={`flex items-center group hover:bg-bg-hover ${bm.page === currentPage ? 'bg-bg-hover/50' : ''}`}
                      style={{ paddingLeft: `${8 + (bm.level - 1) * 12}px` }}>
                      <button className={`flex-1 text-left py-2 text-xs truncate ${bm.page === currentPage ? 'text-accent font-medium' : 'text-fg-secondary'}`}
                        onClick={() => goToPage(bm.page)}>
                        {bm.title || `Page ${bm.page + 1}`}
                        <span className="text-[10px] text-fg-tertiary ml-1">p{bm.page + 1}</span>
                      </button>
                      <button onClick={() => deleteBookmark(idx)}
                        className="opacity-0 group-hover:opacity-100 pr-2 text-fg-tertiary hover:text-danger text-sm leading-none">×</button>
                    </div>
                  ))}
            </div>
          </div>
        )}

        {/* Diff panel */}
        {diffPanel && diffChanges.length >= 0 && (
          <div className="w-[220px] bg-bg-surface border-r border-border flex flex-col shrink-0">
            <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
              <span className="text-xs font-semibold text-fg-primary flex-1">Comparison</span>
              <button onClick={() => { setDiffChanges([]); setDiffSummary(null); setDiffPanel(false) }}
                className="text-[10px] text-fg-tertiary hover:text-danger">Clear</button>
              <button onClick={() => setDiffPanel(false)} className="text-fg-tertiary hover:text-fg-primary text-base leading-none">×</button>
            </div>
            {diffSummary && (
              <div className="px-3 py-2 border-b border-border flex gap-3 text-xs">
                <span className="text-green-600 font-medium">+{diffSummary.added} added</span>
                <span className="text-danger font-medium">−{diffSummary.removed} removed</span>
              </div>
            )}
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {diffChanges.length === 0
                ? <p className="text-xs text-fg-tertiary px-3 py-6 text-center">No differences found.</p>
                : diffChanges.map((c, i) => (
                  <button key={i} onClick={() => goToPage(c.page)}
                    className={`w-full text-left px-3 py-2 hover:bg-bg-hover ${c.page === currentPage ? 'bg-bg-hover/50' : ''}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-bold ${c.kind === 'added' ? 'text-green-600' : 'text-danger'}`}>
                        {c.kind === 'added' ? '+' : '−'}
                      </span>
                      <span className="text-[10px] text-fg-tertiary">p{c.page + 1}</span>
                    </div>
                    <p className="text-xs text-fg-secondary truncate">{c.text}</p>
                  </button>
                ))
              }
            </div>
          </div>
        )}

        {/* Undo history panel */}
        {undoPanel && (
          <div className="w-[200px] bg-bg-surface border-r border-border flex flex-col shrink-0">
            <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
              <span className="text-xs font-semibold text-fg-primary flex-1">Undo History</span>
              <button onClick={loadUndoSteps} className="text-[10px] text-accent hover:underline" title="Refresh">↺</button>
              <button onClick={() => setUndoPanel(false)} className="text-fg-tertiary hover:text-fg-primary text-base leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {undoSteps.length === 0
                ? <p className="text-xs text-fg-tertiary px-3 py-6 text-center">No changes to undo.</p>
                : (
                  <div className="divide-y divide-border">
                    <div className="px-3 py-2 bg-accent/5 flex items-center gap-2">
                      <span className="text-[10px] w-2 h-2 rounded-full bg-accent inline-block shrink-0" />
                      <span className="text-xs text-accent font-medium">Current</span>
                    </div>
                    {[...undoSteps].reverse().map((s, i) => {
                      const d = new Date(s.ts)
                      const label = isNaN(d.getTime()) ? `Step ${s.index + 1}` : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      return (
                        <button key={s.index} onClick={async () => {
                          await handleUndoRef.current()
                          loadUndoSteps()
                        }}
                          className="w-full text-left px-3 py-2 hover:bg-bg-hover flex items-center gap-2">
                          <span className="text-[10px] w-2 h-2 rounded-full bg-border inline-block shrink-0" />
                          <span className="text-xs text-fg-secondary">v{undoSteps.length - i}</span>
                          <span className="text-[10px] text-fg-tertiary ml-auto tabular-nums">{label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
            </div>
            {undoSteps.length > 0 && (
              <div className="p-3 border-t border-border">
                <button onClick={async () => { await handleUndoRef.current(); loadUndoSteps() }}
                  className="w-full text-xs py-1.5 bg-bg-base border border-border rounded-lg text-fg-secondary hover:text-fg-primary hover:bg-bg-hover">
                  Undo one step (Ctrl+Z)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Page canvas — single or continuous */}
        <div ref={containerRef} className={`flex-1 bg-bg-surface overflow-auto p-6 ${viewMode === 'single' ? 'flex items-start justify-center' : 'flex flex-col items-center gap-4'}`}>
          {viewMode === 'continuous' && pageInfos.length > 0 && Array.from({ length: pageCount }, (_, i) => {
            const pi = pageInfos[i]; if (!pi) return null
            const dw2 = Math.round(pi.widthPx * zoom / 100)
            const dh2 = Math.round(pi.heightPx * zoom / 100)
            const isActive = i === currentPage
            const pageComments2 = comments.filter(c => c.page === i)
            return (
              <div key={i} ref={el => { pageRefs.current[i] = el }} data-page={i}
                className={`relative inline-block shadow-lg shrink-0 ${isActive ? 'ring-2 ring-accent/50' : ''}`}
                onClick={() => !isActive && setCurrentPage(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pageUrl(i)} width={dw2} height={dh2} alt={`Page ${i + 1}`}
                  style={{ display: 'block', userSelect: 'none', width: dw2, height: dh2 }} draggable={false} />
                <svg style={{ position: 'absolute', top: 0, left: 0, width: dw2, height: dh2,
                    cursor: isActive ? toolCursor[tool] : 'default',
                    pointerEvents: isActive && tool !== 'select' ? 'all' : 'none' }}
                  onMouseDown={isActive ? onSvgDown : undefined}
                  onMouseMove={isActive ? onSvgMove : undefined}
                  onMouseUp={isActive ? onSvgUp : undefined}
                  onMouseLeave={isActive ? onSvgUp : undefined}>
                  {searchResults.filter(r => r.page === i).map((r, ri) => {
                    const [sx0,sy0,sx1,sy1] = r.rect.map(v => v * renderScale)
                    return <rect key={ri} x={sx0} y={sy0} width={sx1-sx0} height={sy1-sy0}
                      fill="rgba(251,191,36,0.4)" style={{ pointerEvents: 'none' }} />
                  })}
                  {redactRegions.filter(r => r.page === i).map(r => (
                    <rect key={r.id} x={r.ptX0*renderScale} y={r.ptY0*renderScale}
                      width={(r.ptX1-r.ptX0)*renderScale} height={(r.ptY1-r.ptY0)*renderScale}
                      fill="rgba(239,68,68,0.35)" stroke="#ef4444" strokeWidth={1.5} />
                  ))}
                  {pageComments2.map((c, idx) => {
                    if (!c.rect) return null
                    const [cx0,cy0] = c.rect.map(v => v * renderScale)
                    return <circle key={c.id} cx={cx0+8} cy={cy0-4} r={7}
                      fill={c.resolved ? '#16a34a' : '#f59e0b'} stroke="white" strokeWidth={1.5}
                      style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setCommentPanel(true) }} />
                  })}
                  {isActive && draw.kind === 'arrow' && (
                    <line x1={draw.x0} y1={draw.y0} x2={draw.x1} y2={draw.y1}
                      stroke={color} strokeWidth={2} markerEnd="url(#arrowhead2)" />
                  )}
                  <defs>
                    <marker id="arrowhead2" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                      <polygon points="0 0, 8 3, 0 6" fill={color} />
                    </marker>
                  </defs>
                </svg>
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-fg-tertiary bg-bg-raised/70 px-1.5 rounded select-none">{i + 1}</div>
              </div>
            )
          })}
          {viewMode === 'single' && pageInfo ? (
            <div className="relative inline-block shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pageUrl(currentPage)} width={dw} height={dh}
                alt={`Page ${currentPage + 1}`}
                style={{ display: 'block', userSelect: 'none', width: dw, height: dh }}
                draggable={false} />

              <svg ref={svgRef} style={{
                  position: 'absolute', top: 0, left: 0, width: dw, height: dh,
                  cursor: draw.kind === 'annot-drag' ? 'grabbing' : toolCursor[tool],
                  pointerEvents: 'all',
                }}
                onMouseDown={onSvgDown} onMouseMove={onSvgMove}
                onMouseUp={onSvgUp} onMouseLeave={onSvgUp} onContextMenu={onSvgContextMenu}>

                {/* Search highlights */}
                {searchResults.map((r, i) => {
                  if (r.page !== currentPage) return null
                  const [sx0, sy0, sx1, sy1] = r.rect.map(v => v * renderScale)
                  return (
                    <rect key={`s${i}`} x={sx0} y={sy0} width={sx1 - sx0} height={sy1 - sy0}
                      fill={i === searchIndex ? 'rgba(251,191,36,0.55)' : 'rgba(251,191,36,0.25)'}
                      stroke={i === searchIndex ? '#f59e0b' : 'none'} strokeWidth={1.5}
                      style={{ pointerEvents: 'none' }} />
                  )
                })}

                {/* Diff change overlays */}
                {diffChanges.filter(c => c.page === currentPage).map((c, i) => {
                  const [dx0,dy0,dx1,dy1] = c.rect.map(v => v * renderScale)
                  return (
                    <rect key={`d${i}`} x={dx0} y={dy0} width={dx1-dx0} height={dy1-dy0}
                      fill={c.kind === 'added' ? 'rgba(22,163,74,0.35)' : 'rgba(239,68,68,0.35)'}
                      stroke={c.kind === 'added' ? '#16a34a' : '#ef4444'} strokeWidth={1}
                      style={{ pointerEvents: 'none' }} />
                  )
                })}

                {/* Word rects for text markup tools */}
                {isTextTool && textWords.map((w, i) => {
                  const [wx0, wy0, wx1, wy1] = w.rect.map(v => v * renderScale)
                  const inSel = selRange !== null && i >= selRange[0] && i <= selRange[1]
                  const fill = inSel
                    ? tool === 'underline' ? 'rgba(59,130,246,0.3)'
                      : tool === 'strikethrough' ? 'rgba(239,68,68,0.3)'
                      : 'rgba(253,224,71,0.5)'
                    : 'transparent'
                  return (
                    <rect key={`w${i}`} x={wx0} y={wy0} width={wx1 - wx0} height={wy1 - wy0}
                      fill={fill} stroke="none" style={{ cursor: 'text' }}
                      onMouseDown={e => {
                        e.stopPropagation()
                        selAnchorRef.current = i; selFocusRef.current = i; setSelRange([i, i])
                      }}
                      onMouseEnter={() => {
                        if (selAnchorRef.current === null) return
                        selFocusRef.current = i
                        const a = selAnchorRef.current
                        setSelRange([Math.min(a, i), Math.max(a, i)])
                      }}
                      onMouseUp={e => { e.stopPropagation(); commitTextSelection() }}
                    />
                  )
                })}

                {/* Redact regions */}
                {redactRegions.filter(r => r.page === currentPage).map(r => (
                  <rect key={r.id}
                    x={r.ptX0 * renderScale} y={r.ptY0 * renderScale}
                    width={(r.ptX1 - r.ptX0) * renderScale} height={(r.ptY1 - r.ptY0) * renderScale}
                    fill="rgba(239,68,68,0.35)" stroke="#ef4444" strokeWidth={1.5} />
                ))}
                {draw.kind === 'redact-rect' && (
                  <rect x={Math.min(draw.x0, draw.x1)} y={Math.min(draw.y0, draw.y1)}
                    width={Math.abs(draw.x1 - draw.x0)} height={Math.abs(draw.y1 - draw.y0)}
                    fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" />
                )}

                {/* Draw shapes */}
                {draw.kind === 'arrow' && (
                  <line x1={draw.x0} y1={draw.y0} x2={draw.x1} y2={draw.y1}
                    stroke={color} strokeWidth={2} markerEnd="url(#arrowhead)" />
                )}
                {draw.kind === 'freehand' && draw.pts.length >= 2 && (
                  <polyline points={draw.pts.map(p => `${p[0]},${p[1]}`).join(' ')}
                    fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                )}
                {draw.kind === 'shape-rect' && (() => {
                  const x = Math.min(draw.x0, draw.x1); const y = Math.min(draw.y0, draw.y1)
                  const w = Math.abs(draw.x1 - draw.x0); const h = Math.abs(draw.y1 - draw.y0)
                  if (draw.shape === 'rect')
                    return <rect x={x} y={y} width={w} height={h} fill="none" stroke={color} strokeWidth={lineWidth} strokeDasharray="4 2" />
                  if (draw.shape === 'circle')
                    return <ellipse cx={x + w/2} cy={y + h/2} rx={w/2} ry={h/2} fill="none" stroke={color} strokeWidth={lineWidth} strokeDasharray="4 2" />
                  return <line x1={draw.x0} y1={draw.y0} x2={draw.x1} y2={draw.y1} stroke={color} strokeWidth={lineWidth} strokeDasharray="4 2" />
                })()}
                {draw.kind === 'crop-rect' && (
                  <rect x={Math.min(draw.x0,draw.x1)} y={Math.min(draw.y0,draw.y1)}
                    width={Math.abs(draw.x1-draw.x0)} height={Math.abs(draw.y1-draw.y0)}
                    fill="rgba(99,102,241,0.1)" stroke="#6366f1" strokeWidth={2} strokeDasharray="6 3" />
                )}
                {cropRect && (
                  <rect x={cropRect.x0} y={cropRect.y0} width={cropRect.x1-cropRect.x0} height={cropRect.y1-cropRect.y0}
                    fill="rgba(99,102,241,0.08)" stroke="#6366f1" strokeWidth={2} />
                )}
                {draw.kind === 'image-rect' && (
                  <rect x={Math.min(draw.x0,draw.x1)} y={Math.min(draw.y0,draw.y1)}
                    width={Math.abs(draw.x1-draw.x0)} height={Math.abs(draw.y1-draw.y0)}
                    fill="rgba(16,163,74,0.1)" stroke="#16a34a" strokeWidth={2} strokeDasharray="4 2" />
                )}
                {draw.kind === 'link-rect' && (
                  <rect x={Math.min(draw.x0,draw.x1)} y={Math.min(draw.y0,draw.y1)}
                    width={Math.abs(draw.x1-draw.x0)} height={Math.abs(draw.y1-draw.y0)}
                    fill="rgba(59,130,246,0.1)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 2" />
                )}
                {draw.kind === 'field-rect' && (
                  <rect x={Math.min(draw.x0,draw.x1)} y={Math.min(draw.y0,draw.y1)}
                    width={Math.abs(draw.x1-draw.x0)} height={Math.abs(draw.y1-draw.y0)}
                    fill="rgba(139,92,246,0.1)" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 2" />
                )}

                {/* Comment markers */}
                {pageComments.map((c, idx) => {
                  if (!c.rect) return null
                  const [cx0, cy0, cx1, cy1] = c.rect.map(v => v * renderScale)
                  return (
                    <g key={c.id} style={{ cursor: 'pointer' }}
                      onClick={e => { e.stopPropagation(); setCommentPanel(true) }}>
                      <rect x={cx0} y={cy0} width={cx1 - cx0} height={cy1 - cy0}
                        fill={c.resolved ? 'rgba(22,163,74,0.1)' : 'rgba(251,191,36,0.2)'}
                        stroke={c.resolved ? '#16a34a' : '#f59e0b'} strokeWidth={1}
                        strokeDasharray={c.resolved ? '3 2' : undefined} />
                      <circle cx={cx0 + 10} cy={cy0 - 8} r={9} fill={c.resolved ? '#16a34a' : '#f59e0b'} stroke="white" strokeWidth={1.5} />
                      <text x={cx0 + 10} y={cy0 - 4} fill="white" fontSize={8} textAnchor="middle" fontWeight="bold">{idx + 1}</text>
                    </g>
                  )
                })}

                {/* Annotation selection handles */}
                {selectedAnnot && tool === 'select' && (() => {
                  const [rx0,ry0,rx1,ry1] = selectedAnnot.rect.map(v => v * renderScale)
                  const cx = (rx0+rx1)/2; const cy = (ry0+ry1)/2
                  const hpts: [number,number,string][] = [
                    [rx0,ry0,'nwse-resize'],[cx,ry0,'ns-resize'],[rx1,ry0,'nesw-resize'],
                    [rx0,cy,'ew-resize'],[rx1,cy,'ew-resize'],
                    [rx0,ry1,'nesw-resize'],[cx,ry1,'ns-resize'],[rx1,ry1,'nwse-resize'],
                  ]
                  return (
                    <g>
                      <rect x={rx0} y={ry0} width={rx1-rx0} height={ry1-ry0}
                        fill="none" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 3"
                        style={{ cursor: 'move', pointerEvents: 'all' }} />
                      {hpts.map(([hx,hy,cur], i) => (
                        <rect key={i} x={hx-5} y={hy-5} width={10} height={10}
                          fill="white" stroke="#6366f1" strokeWidth={1.5} rx={2}
                          style={{ cursor: cur, pointerEvents: 'all' }} />
                      ))}
                      <text x={rx0} y={ry0 - 6} fill="#6366f1" fontSize={9} fontFamily="sans-serif">
                        Del to remove
                      </text>
                    </g>
                  )
                })()}

                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill={color} />
                  </marker>
                </defs>
              </svg>

              {/* Text input overlay */}
              {draw.kind === 'text-placing' && (
                <div style={{ position: 'absolute', left: draw.x, top: draw.y, zIndex: 10 }} className="flex">
                  {draw.sticky && (
                    <div className="w-6 h-6 rounded-sm flex items-center justify-center mr-1" style={{ background: '#fef08a' }}>
                      <Icon d={ICONS.sticky} size={12} />
                    </div>
                  )}
                  <input ref={textInputRef} value={textVal}
                    onChange={e => setTextVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setDraw({ kind: 'idle' }) }}
                    onBlur={commitText}
                    placeholder={draw.sticky ? 'Sticky note…' : 'Type text…'}
                    className="border border-accent bg-white text-black text-sm px-2 py-0.5 rounded shadow-lg outline-none"
                    style={{ minWidth: 120, color: color !== '#000000' ? color : '#000' }} />
                </div>
              )}

              {/* Comment placement popup */}
              {commentPlacing && (
                <div style={{ position: 'absolute', left: Math.min(commentPlacing.svgX, dw - 270), top: commentPlacing.svgY + 8, zIndex: 20 }}
                  className="bg-bg-raised border border-border rounded-xl shadow-card p-3 w-64"
                  onMouseDown={e => e.stopPropagation()}>
                  <p className="text-xs font-medium text-fg-primary mb-2">Add comment</p>
                  <textarea ref={commentInputRef} value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitComment() }}
                    rows={3} placeholder="Type your comment… (Ctrl+Enter to submit)"
                    className="w-full border border-border rounded-md px-2 py-1.5 text-xs bg-bg-base text-fg-primary resize-none focus:outline-none focus:ring-1 focus:ring-accent" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => { setCommentPlacing(null); setTool('select') }}
                      className="flex-1 text-xs text-fg-secondary border border-border rounded-md py-1.5 hover:bg-bg-hover">Cancel</button>
                    <button onClick={submitComment}
                      className="flex-1 bg-accent text-accent-fg text-xs rounded-md py-1.5 hover:bg-accent-h">Comment</button>
                  </div>
                </div>
              )}
            </div>
          ) : viewMode === 'single' ? (
            <div className="text-fg-tertiary text-sm">No pages</div>
          ) : null}
        </div>

        {/* Redact panel */}
        {tool === 'redact' && (
          <div className="w-[220px] bg-bg-surface border-l border-border flex flex-col shrink-0">
            <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
              <span className="text-xs font-semibold text-fg-primary flex-1">Redact Regions</span>
              {redactRegions.length > 0 && (
                <span className="text-[10px] bg-danger text-white rounded-full px-1.5 py-0.5 font-medium">{redactRegions.length}</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {redactRegions.length === 0 ? (
                <p className="text-xs text-fg-tertiary px-3 py-6 text-center leading-5">Draw rectangles over sensitive content to mark it for redaction.</p>
              ) : (
                <div className="py-1">
                  {redactRegions.map((r, i) => (
                    <div key={r.id} onClick={() => setCurrentPage(r.page)}
                      className={`flex items-center px-3 py-1.5 gap-2 cursor-pointer ${r.page === currentPage ? 'bg-danger/10' : 'hover:bg-bg-hover'}`}>
                      <span className="text-[10px] w-4 h-4 rounded-full bg-danger text-white flex items-center justify-center font-medium shrink-0">{i + 1}</span>
                      <span className="text-xs text-fg-secondary flex-1">Page {r.page + 1}</span>
                      <button onClick={e => { e.stopPropagation(); setRedactRegions(prev => prev.filter(x => x.id !== r.id)) }}
                        className="text-fg-tertiary hover:text-danger text-sm leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-border flex flex-col gap-2">
              <button onClick={handleRedact} disabled={redactRegions.length === 0 || redacting}
                className="w-full bg-danger text-white text-xs font-semibold py-2 rounded-lg hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none">
                {redacting ? 'Applying…' : redactRegions.length === 0 ? 'Mark regions above' : `Apply ${redactRegions.length} Redaction${redactRegions.length !== 1 ? 's' : ''}`}
              </button>
              {redactRegions.length > 0 && (
                <button onClick={() => setRedactRegions([])} className="text-xs text-fg-tertiary hover:text-danger text-center py-0.5">Clear all</button>
              )}
            </div>
          </div>
        )}

        {/* Annotation list panel */}
        {annotListPanel && tool !== 'redact' && (
          <div className="w-[240px] bg-bg-surface border-l border-border flex flex-col shrink-0">
            <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
              <span className="text-xs font-semibold text-fg-primary flex-1">Annotations</span>
              <button onClick={loadAllAnnots} className="text-[10px] text-accent hover:underline" title="Refresh">↺</button>
              <button onClick={() => setAnnotListPanel(false)} className="text-fg-tertiary hover:text-fg-primary text-base leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {annotListLoading
                ? <p className="text-xs text-fg-tertiary px-3 py-6 text-center">Loading…</p>
                : allAnnots.length === 0
                  ? <p className="text-xs text-fg-tertiary px-3 py-6 text-center">No annotations found.</p>
                  : <div className="divide-y divide-border">
                      {allAnnots.map((a, idx) => (
                        <button key={idx} onClick={() => goToPage(a.page)}
                          className={`w-full text-left px-3 py-2 hover:bg-bg-hover ${a.page === currentPage ? 'bg-bg-hover/50' : ''}`}>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] bg-bg-base border border-border rounded px-1 text-fg-tertiary">{a.type}</span>
                            <span className="text-[10px] text-fg-tertiary">p{a.page + 1}</span>
                          </div>
                          {a.content && <p className="text-xs text-fg-secondary truncate">{a.content}</p>}
                        </button>
                      ))}
                    </div>}
            </div>
          </div>
        )}

        {/* Comment panel (fix #4: decoupled from tool; + Add sets tool) */}
        {commentPanel && tool !== 'redact' && (
          <div className="w-[260px] bg-bg-surface border-l border-border flex flex-col shrink-0">
            <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
              <span className="text-xs font-semibold text-fg-primary flex-1">
                Comments {comments.length > 0 && `(${comments.length})`}
              </span>
              <button onClick={() => setTool('comment')}
                className={`text-[10px] px-2 py-0.5 rounded ${tool === 'comment' ? 'bg-accent text-accent-fg' : 'text-accent hover:underline'}`}>
                + Add
              </button>
              <button onClick={() => setCommentPanel(false)} className="text-fg-tertiary hover:text-fg-primary text-base leading-none">×</button>
            </div>
            {/* fix #4: contextual hint when comment tool is active */}
            {tool === 'comment' && (
              <div className="px-3 py-2 text-[11px] text-fg-tertiary border-b border-border" style={{ background: 'rgba(251,191,36,0.06)' }}>
                Click anywhere on the page to place a comment.
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-xs text-fg-tertiary px-3 py-6 text-center leading-5">
                  Click <strong>+ Add</strong> then click anywhere on the page.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {comments.map((c, idx) => (
                    <div key={c.id} onClick={() => setCurrentPage(c.page)}
                      className={`p-3 cursor-pointer ${c.page === currentPage ? 'bg-bg-hover' : 'hover:bg-bg-hover/50'} ${c.resolved ? 'opacity-60' : ''}`}>
                      <div className="flex items-start gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] text-fg-tertiary">p{c.page + 1}</span>
                            {c.resolved && <span className="text-[10px] text-green-600 font-medium">Resolved</span>}
                          </div>
                          <p className="text-xs text-fg-primary leading-relaxed">{c.text}</p>
                        </div>
                      </div>
                      {c.replies.map(r => (
                        <div key={r.id} className="ml-7 mt-1.5 text-xs text-fg-secondary leading-relaxed border-l-2 border-border pl-2">{r.text}</div>
                      ))}
                      <div className="ml-7 mt-2 flex gap-1.5" onClick={e => e.stopPropagation()}>
                        <input
                          value={replyTexts[c.id] ?? ''}
                          onChange={e => setReplyTexts(prev => ({ ...prev, [c.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') addReply(c.id) }}
                          placeholder="Reply…"
                          className="flex-1 border border-border rounded-md px-2 py-1 text-[11px] bg-bg-base text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent" />
                        <button onClick={() => addReply(c.id)}
                          className="text-[10px] px-2 bg-accent text-accent-fg rounded-md hover:bg-accent-h">↵</button>
                      </div>
                      <div className="ml-7 mt-1.5 flex gap-3" onClick={e => e.stopPropagation()}>
                        <button onClick={() => resolveComment(c.id, !c.resolved)}
                          className={`text-[10px] ${c.resolved ? 'text-fg-tertiary hover:text-fg-secondary' : 'text-green-600 hover:text-green-700'}`}>
                          {c.resolved ? 'Re-open' : 'Resolve'}
                        </button>
                        <button onClick={() => deleteComment(c.id)} className="text-[10px] text-fg-tertiary hover:text-danger">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Fix #2 + #6: status bar — page navigation + fit controls ────────── */}
      <div className="h-8 bg-bg-raised border-t border-border flex items-center px-4 gap-3 shrink-0 text-xs text-fg-tertiary select-none">
        <div className="flex items-center gap-1.5">
          <button onClick={() => goToPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-bg-hover disabled:opacity-30 text-fg-secondary">
            <Icon d={ICONS.chevLeft} size={12} />
          </button>
          <span>Page</span>
          <input
            type="number" min={1} max={pageCount}
            value={currentPage + 1}
            onChange={e => {
              const n = parseInt(e.target.value) - 1
              if (!isNaN(n) && n >= 0 && n < pageCount) goToPage(n)
            }}
            className="w-10 border border-border rounded px-1 py-0 text-xs text-center bg-bg-base text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent" />
          <span>of {pageCount}</span>
          <button onClick={() => goToPage(Math.min(pageCount - 1, currentPage + 1))} disabled={currentPage >= pageCount - 1}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-bg-hover disabled:opacity-30 text-fg-secondary">
            <Icon d={ICONS.chevRight} size={12} />
          </button>
        </div>
        <div className="w-px h-4 bg-border" />
        {/* fix #3: fit controls */}
        <button onClick={fitWidth} className="hover:text-fg-primary hover:bg-bg-hover px-1.5 py-0.5 rounded transition-colors">Fit Width</button>
        <button onClick={fitPage}  className="hover:text-fg-primary hover:bg-bg-hover px-1.5 py-0.5 rounded transition-colors">Fit Page</button>
        <div className="flex-1" />
        <span className="tabular-nums">{zoom}%</span>
      </div>

      {/* ── Form field dialog ─────────────────────────────────────────────────── */}
      {fieldDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-bg-raised rounded-xl border border-border shadow-card p-6 w-96">
            <h2 className="text-sm font-semibold text-fg-primary mb-4">
              Add {fieldType === 'text' ? 'Text' : fieldType === 'checkbox' ? 'Checkbox' : fieldType === 'dropdown' ? 'Dropdown' : 'Signature'} Field
            </h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-fg-tertiary">Field name (used in form data)</span>
                <input autoFocus value={fieldName} onChange={e => setFieldName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && fieldType !== 'dropdown') createField() }}
                  className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent" />
              </label>
              {fieldType === 'dropdown' && (
                <label className="block">
                  <span className="text-xs text-fg-tertiary">Options (one per line)</span>
                  <textarea value={fieldChoices} onChange={e => setFieldChoices(e.target.value)} rows={4}
                    className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent resize-none" />
                </label>
              )}
              {fieldType === 'text' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={fieldMultiline} onChange={e => setFieldMultiline(e.target.checked)}
                    className="accent-accent" />
                  <span className="text-xs text-fg-secondary">Multi-line text area</span>
                </label>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={fieldRequired} onChange={e => setFieldRequired(e.target.checked)}
                  className="accent-accent" />
                <span className="text-xs text-fg-secondary">Required field</span>
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setFieldDialog(null)}
                className="flex-1 text-sm text-fg-secondary border border-border rounded-lg py-2 hover:bg-bg-hover">Cancel</button>
              <button onClick={createField}
                className="flex-1 bg-accent text-accent-fg text-sm rounded-lg py-2 hover:bg-accent-h">
                Add field
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── OCR modal ─────────────────────────────────────────────────────────── */}
      {ocrOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-bg-raised rounded-xl border border-border shadow-card p-6 w-96">
            <h2 className="text-sm font-semibold text-fg-primary mb-1">Make Document Searchable</h2>
            <p className="text-xs text-fg-tertiary mb-4">
              Runs Tesseract OCR to add an invisible text layer to scanned pages.
              Pages that already have selectable text are skipped.
              Large documents may take up to a minute.
            </p>
            <label className="block mb-5">
              <span className="text-xs text-fg-tertiary">Language</span>
              <select value={ocrLang} onChange={e => setOcrLang(e.target.value)}
                className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent">
                <option value="eng">English</option>
                <option value="fra">French</option>
                <option value="deu">German</option>
                <option value="spa">Spanish</option>
                <option value="ita">Italian</option>
                <option value="por">Portuguese</option>
                <option value="nld">Dutch</option>
                <option value="chi_sim">Chinese (Simplified)</option>
                <option value="jpn">Japanese</option>
                <option value="ara">Arabic</option>
                <option value="eng+fra">English + French</option>
                <option value="eng+deu">English + German</option>
                <option value="eng+spa">English + Spanish</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setOcrOpen(false)}
                className="flex-1 text-sm text-fg-secondary border border-border rounded-lg py-2 hover:bg-bg-hover">Cancel</button>
              <button onClick={async () => { setOcrOpen(false); await doOcr() }} disabled={ocrRunning}
                className="flex-1 bg-accent text-accent-fg text-sm rounded-lg py-2 hover:bg-accent-h disabled:opacity-40">
                {ocrRunning ? 'Running OCR…' : 'Run OCR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link URI modal ────────────────────────────────────────────────────── */}
      {linkModalRect && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-bg-raised rounded-xl border border-border shadow-card p-6 w-96">
            <h2 className="text-sm font-semibold text-fg-primary mb-1">Insert Hyperlink</h2>
            <p className="text-xs text-fg-tertiary mb-4">The selected area will become a clickable link in the PDF.</p>
            <label className="block mb-4">
              <span className="text-xs text-fg-tertiary">URL</span>
              <input autoFocus value={linkUri} onChange={e => setLinkUri(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addLink(); if (e.key === 'Escape') setLinkModalRect(null) }}
                placeholder="https://example.com"
                className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent" />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setLinkModalRect(null)}
                className="flex-1 text-sm text-fg-secondary border border-border rounded-lg py-2 hover:bg-bg-hover">Cancel</button>
              <button onClick={addLink}
                disabled={!linkUri.trim() || (!linkUri.startsWith('http://') && !linkUri.startsWith('https://') && !linkUri.startsWith('mailto:'))}
                className="flex-1 bg-accent text-accent-fg text-sm rounded-lg py-2 hover:bg-accent-h disabled:opacity-40">
                Add link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast notification ───────────────────────────────────────────────── */}
      <div className={`fixed bottom-8 right-6 z-[200] pointer-events-none transition-all duration-300
        ${toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
        <div className="bg-fg-primary text-bg-base text-xs font-medium px-4 py-2.5 rounded-xl shadow-card whitespace-nowrap">
          {status}
        </div>
      </div>

      {/* ── Right-click context menu ─────────────────────────────────────────── */}
      {contextMenu && (
        <div
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 200 }}
          className="bg-bg-raised border border-border rounded-xl shadow-card py-1 w-44"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}>
          <button
            onClick={() => { deleteAnnot(contextMenu.annotIdx); setContextMenu(null) }}
            className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 hover:bg-bg-hover text-xs text-danger">
            <Icon d={ICONS.trash} size={14} />
            Delete annotation
          </button>
        </div>
      )}

      {/* ── Split dialog ─────────────────────────────────────────────────────── */}
      {splitDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-bg-raised rounded-xl border border-border shadow-card p-6 w-80">
            <h2 className="text-sm font-semibold text-fg-primary mb-4">Split PDF</h2>
            <p className="text-xs text-fg-secondary mb-4">Extract a page range into a new file. Original is unchanged. Document has {pageCount} page{pageCount !== 1 ? 's' : ''}.</p>
            <div className="flex gap-3 mb-5">
              <label className="flex-1">
                <span className="text-xs text-fg-tertiary block mb-1">From page</span>
                <input type="number" min={1} max={pageCount} value={splitStart}
                  onChange={e => setSplitStart(e.target.value)}
                  className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-bg-base text-fg-primary" />
              </label>
              <label className="flex-1">
                <span className="text-xs text-fg-tertiary block mb-1">To page</span>
                <input type="number" min={1} max={pageCount} value={splitEnd}
                  onChange={e => setSplitEnd(e.target.value)}
                  className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-bg-base text-fg-primary" />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSplitDialog(false)} className="text-sm text-fg-secondary hover:text-fg-primary px-3 py-1.5">Cancel</button>
              <button onClick={handleSplit} disabled={saving}
                className="bg-accent text-accent-fg text-sm px-4 py-1.5 rounded-lg hover:bg-accent-h">
                {saving ? 'Splitting…' : 'Split'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Watermark modal (fix #5: destructive warning) ─────────────────────── */}
      {watermarkOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-bg-raised rounded-xl border border-border shadow-card p-6 w-96">
            <h2 className="text-sm font-semibold text-fg-primary mb-1">Add Watermark</h2>
            {/* fix #5: warn that watermark permanently modifies the stored file */}
            <p className="text-xs text-fg-tertiary mb-4">
              This permanently modifies the document.&nbsp;
              <span className="font-medium text-fg-secondary">Use Undo (Ctrl+Z) to reverse.</span>
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-fg-tertiary">Text</span>
                <input value={wmText} onChange={e => setWmText(e.target.value)}
                  className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary" />
              </label>
              <div className="flex gap-3">
                <label className="flex-1">
                  <span className="text-xs text-fg-tertiary">Opacity — {wmOpacity}%</span>
                  <input type="range" min={5} max={80} value={wmOpacity}
                    onChange={e => setWmOpacity(Number(e.target.value))}
                    className="mt-1 w-full accent-accent" />
                </label>
                <label className="flex-1">
                  <span className="text-xs text-fg-tertiary">Angle — {wmAngle}°</span>
                  <input type="range" min={0} max={90} value={wmAngle}
                    onChange={e => setWmAngle(Number(e.target.value))}
                    className="mt-1 w-full accent-accent" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-fg-tertiary">Color</span>
                <div className="flex items-center gap-3 mt-1">
                  <input type="color" value={wmColor} onChange={e => setWmColor(e.target.value)}
                    className="h-8 w-14 rounded border border-border cursor-pointer bg-transparent" />
                  <div className="flex gap-2">
                    {['#aaaaaa', '#ef4444', '#3b82f6', '#16a34a'].map(c => (
                      <button key={c} onClick={() => setWmColor(c)}
                        className={`w-6 h-6 rounded-full border-2 ${wmColor === c ? 'border-fg-primary' : 'border-transparent'}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setWatermarkOpen(false)}
                className="flex-1 text-sm text-fg-secondary border border-border rounded-lg py-2 hover:bg-bg-hover">Cancel</button>
              <button onClick={doWatermark} disabled={watermarking || !wmText.trim()}
                className="flex-1 bg-accent text-accent-fg text-sm rounded-lg py-2 hover:bg-accent-h disabled:opacity-40">
                {watermarking ? 'Applying…' : 'Apply to all pages'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── eSignature modal ────────────────────────────────────────────────── */}
      {sigOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-bg-raised rounded-xl border border-border shadow-card p-6 w-[480px]">
            <h2 className="text-sm font-semibold text-fg-primary mb-4">Add Signature</h2>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 border-b border-border">
              {(['draw','type','upload'] as const).map(t => (
                <button key={t} onClick={() => setSigTab(t)}
                  className={`px-3 py-1.5 text-xs capitalize rounded-t-md -mb-px border border-b-0 transition-colors
                    ${sigTab === t ? 'border-border bg-bg-raised text-fg-primary font-medium' : 'border-transparent text-fg-tertiary hover:text-fg-secondary'}`}>
                  {t === 'draw' ? 'Draw' : t === 'type' ? 'Type' : 'Upload image'}
                </button>
              ))}
            </div>

            {sigTab === 'draw' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-fg-tertiary">Ink color</span>
                  <input type="color" value={sigColor} onChange={e => setSigColor(e.target.value)}
                    className="h-7 w-10 rounded border border-border cursor-pointer bg-transparent" />
                  <button onClick={sigClear} className="ml-auto text-xs text-fg-tertiary hover:text-fg-primary">Clear</button>
                </div>
                <canvas ref={sigCanvasRef} width={420} height={160}
                  className="w-full border border-border rounded-lg bg-white touch-none"
                  style={{ cursor: 'crosshair' }}
                  onMouseDown={sigDown} onMouseMove={sigMove} onMouseUp={sigUp} onMouseLeave={sigUp} />
                <p className="text-[11px] text-fg-tertiary mt-1.5">Draw your signature above</p>
              </div>
            )}

            {sigTab === 'type' && (
              <div>
                <input value={sigText} onChange={e => setSigText(e.target.value)}
                  placeholder="Your name"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary mb-3" />
                <div className="flex gap-3 mb-3">
                  <label className="flex-1">
                    <span className="text-xs text-fg-tertiary block mb-1">Font</span>
                    <select value={sigFont} onChange={e => setSigFont(e.target.value)}
                      className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-bg-base text-fg-primary">
                      {['Dancing Script','Pacifico','Great Vibes','Satisfy','Caveat'].map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                  <label className="w-24">
                    <span className="text-xs text-fg-tertiary block mb-1">Color</span>
                    <input type="color" value={sigColor} onChange={e => setSigColor(e.target.value)}
                      className="h-9 w-full rounded border border-border cursor-pointer bg-transparent" />
                  </label>
                </div>
                {sigText && (
                  <div className="border border-border rounded-lg bg-white px-4 py-3 text-center"
                    style={{ fontFamily: `"${sigFont}", cursive`, fontSize: 44, color: sigColor, fontStyle: 'italic', lineHeight: 1.3 }}>
                    {sigText}
                  </div>
                )}
              </div>
            )}

            {sigTab === 'upload' && (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <p className="text-sm text-fg-secondary mb-3">Upload a signature image (PNG with transparent background works best)</p>
                <button onClick={() => imageInputRef.current?.click()}
                  className="px-4 py-2 bg-accent text-accent-fg rounded-lg text-sm hover:bg-accent-h">
                  Choose image
                </button>
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button onClick={() => setSigOpen(false)} className="flex-1 text-sm text-fg-secondary border border-border rounded-lg py-2 hover:bg-bg-hover">Cancel</button>
              {sigTab !== 'upload' && (
                <button onClick={useSignature} disabled={sigTab === 'type' && !sigText.trim()}
                  className="flex-1 bg-accent text-accent-fg text-sm rounded-lg py-2 hover:bg-accent-h disabled:opacity-40">
                  Place on page →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Document properties modal ───────────────────────────────────────── */}
      {propsOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-bg-raised rounded-xl border border-border shadow-card p-6 w-96">
            <h2 className="text-sm font-semibold text-fg-primary mb-4">Document Properties</h2>
            <div className="space-y-3">
              {(['title', 'author', 'subject', 'keywords'] as const).map(k => (
                <label key={k} className="block">
                  <span className="text-xs text-fg-tertiary capitalize">{k}</span>
                  <input value={propsData[k]} onChange={e => setPropsData(p => ({ ...p, [k]: e.target.value }))}
                    className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent" />
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setPropsOpen(false)} className="flex-1 text-sm text-fg-secondary border border-border rounded-lg py-2 hover:bg-bg-hover">Cancel</button>
              <button onClick={doSaveProps} disabled={propsSaving}
                className="flex-1 bg-accent text-accent-fg text-sm rounded-lg py-2 hover:bg-accent-h disabled:opacity-40">
                {propsSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header / Footer modal ────────────────────────────────────────────── */}
      {hfOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-bg-raised rounded-xl border border-border shadow-card p-6 w-96">
            <h2 className="text-sm font-semibold text-fg-primary mb-1">Header &amp; Footer</h2>
            <p className="text-xs text-fg-tertiary mb-4">Use <code className="bg-bg-base px-1 rounded">{'{page}'}</code> and <code className="bg-bg-base px-1 rounded">{'{total}'}</code> for page numbers. Applied to all pages.</p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-fg-tertiary">Header text</span>
                <input value={hfHeader} onChange={e => setHfHeader(e.target.value)}
                  placeholder="e.g. CONFIDENTIAL"
                  className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent" />
              </label>
              <label className="block">
                <span className="text-xs text-fg-tertiary">Footer text</span>
                <input value={hfFooter} onChange={e => setHfFooter(e.target.value)}
                  placeholder="e.g. Page {page} of {total}"
                  className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent" />
              </label>
              <div className="flex gap-3">
                <label className="flex-1">
                  <span className="text-xs text-fg-tertiary">Font size</span>
                  <input type="number" min={6} max={24} value={hfFontSize} onChange={e => setHfFontSize(Number(e.target.value))}
                    className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary" />
                </label>
                <label className="flex-1">
                  <span className="text-xs text-fg-tertiary">Color</span>
                  <input type="color" value={hfColor} onChange={e => setHfColor(e.target.value)}
                    className="mt-0.5 h-9 w-full rounded border border-border cursor-pointer bg-transparent" />
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setHfOpen(false)} className="flex-1 text-sm text-fg-secondary border border-border rounded-lg py-2 hover:bg-bg-hover">Cancel</button>
              <button onClick={doHeaderFooter} disabled={hfApplying || (!hfHeader.trim() && !hfFooter.trim())}
                className="flex-1 bg-accent text-accent-fg text-sm rounded-lg py-2 hover:bg-accent-h disabled:opacity-40">
                {hfApplying ? 'Applying…' : 'Apply to all pages'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete page confirm modal ────────────────────────────────────────── */}
      {deletePageConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-bg-raised rounded-xl border border-border shadow-card p-6 w-80">
            <h2 className="text-sm font-semibold text-fg-primary mb-1">Delete page {currentPage + 1}?</h2>
            <p className="text-xs text-fg-tertiary mb-5">Use Ctrl+Z to undo if needed.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeletePageConfirm(false)}
                className="flex-1 text-sm text-fg-secondary border border-border rounded-lg py-2 hover:bg-bg-hover">Cancel</button>
              <button onClick={confirmDeletePage}
                className="flex-1 bg-danger text-white text-sm rounded-lg py-2 hover:opacity-90">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Digital sign modal ───────────────────────────────────────────────── */}
      {signOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-bg-raised rounded-xl border border-border shadow-card p-6 w-96">
            <h2 className="text-sm font-semibold text-fg-primary mb-1">Sign PDF</h2>
            <p className="text-xs text-fg-tertiary mb-4">
              Creates a self-signed PKCS#12 certificate and embeds a cryptographic signature.
              {savedCert && <span className="text-accent"> Using saved cert for {savedCert.subject}.</span>}
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-fg-tertiary">Your name <span className="text-danger">*</span></span>
                <input value={signName} onChange={e => setSignName(e.target.value)}
                  placeholder="Jane Smith"
                  className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-fg-tertiary">Email (optional)</span>
                  <input value={signEmail} onChange={e => setSignEmail(e.target.value)}
                    placeholder="jane@example.com" type="email"
                    className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary" />
                </label>
                <label className="block">
                  <span className="text-xs text-fg-tertiary">Organization (optional)</span>
                  <input value={signOrg} onChange={e => setSignOrg(e.target.value)}
                    placeholder="Acme Corp"
                    className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-fg-tertiary">Reason (optional)</span>
                <input value={signReason} onChange={e => setSignReason(e.target.value)}
                  placeholder="I approve this document"
                  className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary" />
              </label>
              <label className="block">
                <span className="text-xs text-fg-tertiary">Location (optional)</span>
                <input value={signLocation} onChange={e => setSignLocation(e.target.value)}
                  placeholder="San Francisco, CA"
                  className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary" />
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={signVisible} onChange={e => setSignVisible(e.target.checked)}
                  className="accent-accent" />
                <span className="text-xs text-fg-secondary">Show visible signature on page {currentPage + 1}</span>
              </label>
              {savedCert && (
                <button onClick={() => setSavedCert(null)}
                  className="text-xs text-fg-tertiary underline hover:text-fg-secondary">
                  Clear saved certificate (generate new one)
                </button>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setSignOpen(false)}
                className="flex-1 text-sm text-fg-secondary border border-border rounded-lg py-2 hover:bg-bg-hover">Cancel</button>
              <button onClick={doSign} disabled={signing || !signName.trim()}
                className="flex-1 bg-accent text-accent-fg text-sm rounded-lg py-2 hover:bg-accent-h disabled:opacity-40">
                {signing ? 'Signing…' : 'Sign PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Request-signatures wizard ─────────────────────────────────────────── */}
      {envOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-raised rounded-2xl border border-border shadow-card w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-fg-primary">Request Signatures</h2>
                <div className="flex gap-3 mt-1.5">
                  {['Signers', 'Place fields', 'Send'].map((label, i) => (
                    <span key={i} className={`text-xs ${i === envStep ? 'text-accent font-medium' : i < envStep ? 'text-fg-tertiary line-through' : 'text-fg-tertiary'}`}>
                      {i + 1}. {label}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={envReset} className="text-fg-tertiary hover:text-fg-primary text-lg leading-none">×</button>
            </div>

            {/* ── Step 0: Recipients ─────────────────────────────────────────── */}
            {envStep === 0 && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <label className="block">
                  <span className="text-xs text-fg-tertiary">Document title</span>
                  <input value={envTitle} onChange={e => setEnvTitle(e.target.value)}
                    className="mt-0.5 w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-fg-primary" />
                </label>

                <div>
                  <p className="text-xs font-medium text-fg-secondary mb-2">Add signers</p>
                  <div className="flex gap-2 mb-3">
                    <input value={envNewName} onChange={e => setEnvNewName(e.target.value)}
                      placeholder="Full name"
                      onKeyDown={e => e.key === 'Enter' && envAddRecip()}
                      className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-fg-primary" />
                    <input value={envNewEmail} onChange={e => setEnvNewEmail(e.target.value)}
                      placeholder="Email address" type="email"
                      onKeyDown={e => e.key === 'Enter' && envAddRecip()}
                      className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-fg-primary" />
                    <button onClick={envAddRecip} disabled={!envNewName.trim() || !envNewEmail.trim()}
                      className="px-3 py-2 bg-accent text-accent-fg text-sm rounded-lg disabled:opacity-40">
                      Add
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(() => {
                      const orders = computeOrders(envRecips)
                      return envRecips.map((r, i) => (
                      <div key={r.id} className={`flex items-center gap-2 p-2 rounded-lg border bg-bg-surface ${r.parallel ? 'border-accent/40 ml-4' : 'border-border'}`}>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-fg-primary truncate">{r.name}</p>
                          <p className="text-xs text-fg-tertiary truncate">{r.email}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${r.parallel ? 'text-accent bg-accent/10' : 'text-fg-tertiary bg-bg-hover'}`}>
                            Step {orders[i] + 1}
                          </span>
                          {i > 0 && (
                            <button
                              title={r.parallel ? 'Ungroup — sign in a separate step' : 'Sign in parallel with signer above'}
                              onClick={() => setEnvRecips(prev => {
                                const a = [...prev]
                                a[i] = { ...a[i], parallel: !a[i].parallel }
                                return a
                              })}
                              className={`text-xs px-1 rounded transition-colors ${r.parallel ? 'text-accent hover:text-accent/70' : 'text-fg-tertiary hover:text-fg-primary'}`}>
                              ∥
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (i === 0) return
                              setEnvRecips(prev => {
                                const a = [...prev]
                                ;[a[i - 1], a[i]] = [a[i], a[i - 1]]
                                a[i - 1] = { ...a[i - 1], parallel: false }
                                a[i] = { ...a[i], parallel: false }
                                if (a[i + 1]) a[i + 1] = { ...a[i + 1], parallel: false }
                                return a
                              })
                            }}
                            disabled={i === 0}
                            className="text-fg-tertiary hover:text-fg-primary disabled:opacity-30 text-xs px-0.5">↑</button>
                          <button
                            onClick={() => {
                              if (i === envRecips.length - 1) return
                              setEnvRecips(prev => {
                                const a = [...prev]
                                ;[a[i], a[i + 1]] = [a[i + 1], a[i]]
                                a[i] = { ...a[i], parallel: false }
                                a[i + 1] = { ...a[i + 1], parallel: false }
                                if (a[i + 2]) a[i + 2] = { ...a[i + 2], parallel: false }
                                return a
                              })
                            }}
                            disabled={i === envRecips.length - 1}
                            className="text-fg-tertiary hover:text-fg-primary disabled:opacity-30 text-xs px-0.5">↓</button>
                          <button onClick={() => envRemoveRecip(r.id)} className="text-fg-tertiary hover:text-danger ml-0.5">×</button>
                        </div>
                      </div>
                    ))})()}
                    {envRecips.length === 0 && (
                      <p className="text-xs text-fg-tertiary text-center py-4">Add at least one signer to continue</p>
                    )}
                    {envRecips.length > 1 && (
                      <p className="text-[10px] text-fg-tertiary pt-1">
                        Use ∥ to group signers into the same step. Each step receives invitations only after the previous step completes.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 1: Field placement ─────────────────────────────────────── */}
            {envStep === 1 && (
              <div className="flex-1 flex overflow-hidden">
                {/* Controls sidebar */}
                <div className="w-52 border-r border-border flex flex-col overflow-y-auto shrink-0 p-3 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-fg-secondary mb-1.5">Active signer</p>
                    <div className="space-y-1">
                      {envRecips.map(r => (
                        <button key={r.id} onClick={() => setEnvActiveRecip(r.id)}
                          className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors
                            ${envActiveRecip === r.id ? 'bg-bg-active font-medium text-fg-primary' : 'text-fg-secondary hover:bg-bg-hover'}`}>
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                          <span className="truncate">{r.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-fg-secondary mb-1.5">Field type</p>
                    {(['signature', 'initials', 'date', 'name'] as const).map(t => (
                      <button key={t} onClick={() => setEnvFieldType(t)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs capitalize mb-0.5 transition-colors
                          ${envFieldType === t ? 'bg-accent text-accent-fg' : 'text-fg-secondary hover:bg-bg-hover'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-fg-secondary mb-1.5">
                      Page {envPage + 1} / {pageCount}
                    </p>
                    <div className="flex gap-1">
                      <button onClick={() => setEnvPage(p => Math.max(0, p - 1))} disabled={envPage === 0}
                        className="flex-1 text-xs border border-border rounded px-2 py-1 disabled:opacity-40">←</button>
                      <button onClick={() => setEnvPage(p => Math.min(pageCount - 1, p + 1))} disabled={envPage >= pageCount - 1}
                        className="flex-1 text-xs border border-border rounded px-2 py-1 disabled:opacity-40">→</button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-fg-secondary mb-1">Placed fields</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {envFields.length === 0 && <p className="text-xs text-fg-tertiary">None yet</p>}
                      {envFields.map(f => {
                        const recip = envRecips.find(r => r.id === f.recipId)
                        return (
                          <div key={f.id} className="flex items-center gap-1 text-xs text-fg-tertiary">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: recip?.color }} />
                            <span className="capitalize truncate">{f.type} p{f.page + 1}</span>
                            <button onClick={() => envRemoveField(f.id)} className="ml-auto text-fg-tertiary hover:text-danger">×</button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {!envActiveRecip && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">Select a signer above, then drag on the PDF to place a field</p>
                  )}
                  {envActiveRecip && (
                    <p className="text-xs text-fg-tertiary bg-bg-surface rounded p-2">Drag on the PDF to place a <strong>{envFieldType}</strong> field</p>
                  )}
                </div>

                {/* PDF canvas area */}
                <div className="flex-1 overflow-auto bg-gray-100 p-4">
                  <div
                    ref={envPageRef}
                    className="relative bg-white shadow-sm mx-auto select-none"
                    style={{ maxWidth: 540, cursor: envActiveRecip ? 'crosshair' : 'default' }}
                    onMouseDown={envMouseDown}
                    onMouseMove={envMouseMove}
                    onMouseUp={envMouseUp}
                    onMouseLeave={() => { setEnvDragStart(null); setEnvDragRect(null) }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/pdf/api/pdf/${jobId}/page/${envPage}`}
                      alt={`Page ${envPage + 1}`}
                      className="w-full block pointer-events-none"
                      draggable={false}
                    />

                    {/* Existing field overlays */}
                    {envFields.filter(f => f.page === envPage).map(f => {
                      const recip = envRecips.find(r => r.id === f.recipId)
                      const info = pageInfos[envPage]
                      if (!info) return null
                      const pct = {
                        left: `${(f.x0 / info.width) * 100}%`,
                        top: `${(f.y0 / info.height) * 100}%`,
                        width: `${((f.x1 - f.x0) / info.width) * 100}%`,
                        height: `${((f.y1 - f.y0) / info.height) * 100}%`,
                      }
                      return (
                        <div key={f.id}
                          className="absolute rounded flex items-center justify-center text-white text-[9px] font-medium"
                          style={{ ...pct, background: (recip?.color ?? '#3b82f6') + 'cc', border: `1.5px solid ${recip?.color ?? '#3b82f6'}` }}>
                          <span className="capitalize truncate px-1">{f.type}</span>
                          <button onClick={e => { e.stopPropagation(); envRemoveField(f.id) }}
                            className="absolute top-0 right-0 text-white/80 hover:text-white px-0.5">×</button>
                        </div>
                      )
                    })}

                    {/* Drag preview */}
                    {envDragRect && envActiveRecip && (
                      <div className="absolute pointer-events-none rounded border-2 border-dashed border-blue-500 bg-blue-100/40"
                        style={{
                          left: envDragRect.x, top: envDragRect.y,
                          width: envDragRect.w, height: envDragRect.h,
                        }} />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Review & send ────────────────────────────────────────── */}
            {envStep === 2 && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {!envResult ? (
                  <>
                    <div className="bg-bg-surface rounded-xl border border-border p-4 space-y-2">
                      <p className="text-xs font-medium text-fg-secondary">Document</p>
                      <p className="text-sm text-fg-primary">{envTitle || filename}</p>
                      <p className="text-xs text-fg-tertiary">{envRecips.length} signer{envRecips.length !== 1 ? 's' : ''} · {envFields.length} field{envFields.length !== 1 ? 's' : ''}</p>
                    </div>

                    {/* Signing order flow */}
                    {envRecips.length > 0 && (() => {
                      const orders = computeOrders(envRecips)
                      const stepMap = new Map<number, typeof envRecips>()
                      envRecips.forEach((r, i) => {
                        const s = orders[i]
                        if (!stepMap.has(s)) stepMap.set(s, [])
                        stepMap.get(s)!.push(r)
                      })
                      const steps = Array.from(stepMap.entries()).sort((a, b) => a[0] - b[0])
                      const allParallel = steps.length === 1
                      return (
                        <div>
                          <p className="text-xs font-medium text-fg-secondary mb-2">Signing order</p>
                          <div className="flex items-start gap-2 flex-wrap">
                            {steps.map(([stepIdx, stepRecips], si) => (
                              <div key={stepIdx} className="flex items-center gap-2">
                                {si > 0 && <span className="text-fg-tertiary self-center">→</span>}
                                <div className="border border-border rounded-lg px-3 py-2 bg-bg-surface min-w-0">
                                  <p className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wide mb-1">
                                    Step {si + 1}
                                  </p>
                                  <div className="space-y-0.5">
                                    {stepRecips.map(r => (
                                      <div key={r.id} className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.color }} />
                                        <span className="text-xs text-fg-primary">{r.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-fg-tertiary mt-2">
                            {allParallel
                              ? 'All signers receive invitations simultaneously.'
                              : 'Each step receives invitations only after the previous step completes.'}
                          </p>
                        </div>
                      )
                    })()}

                    <div>
                      <p className="text-xs font-medium text-fg-secondary mb-2">Signers & fields</p>
                      <div className="space-y-1.5">
                        {envRecips.map(r => {
                          const rFields = envFields.filter(f => f.recipId === r.id)
                          return (
                            <div key={r.id} className="flex items-center justify-between text-xs p-2 rounded-lg border border-border bg-bg-surface">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                                <span className="font-medium text-fg-primary">{r.name}</span>
                                <span className="text-fg-tertiary">{r.email}</span>
                              </div>
                              <span className="text-fg-tertiary">
                                {rFields.length > 0
                                  ? rFields.map(f => f.type).join(', ')
                                  : <span className="text-amber-600">No fields</span>}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-xs text-fg-tertiary">Expires after (days)</span>
                      <input type="number" min={1} max={365} value={envExpiry}
                        onChange={e => setEnvExpiry(Number(e.target.value))}
                        className="mt-0.5 w-24 border border-border rounded-lg px-3 py-1.5 text-sm bg-bg-base text-fg-primary" />
                    </label>

                    {envRecips.some(r => !envFields.find(f => f.recipId === r.id)) && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3">
                        Some signers have no fields assigned. They will be able to sign without placing a signature.
                      </p>
                    )}

                    {/* Save as template */}
                    <div className="border border-border rounded-xl p-4 bg-bg-surface space-y-2">
                      <p className="text-xs font-medium text-fg-secondary">Save as template</p>
                      <p className="text-xs text-fg-tertiary">
                        Reuse these signers and field placements on future documents.
                      </p>
                      {envTmplSaved ? (
                        <p className="text-xs text-green-600 font-medium">✓ Template saved</p>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            value={envTmplName}
                            onChange={e => setEnvTmplName(e.target.value)}
                            placeholder={envTitle.trim() || filename.replace(/\.pdf$/i, '')}
                            className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-bg-base text-fg-primary"
                          />
                          <button
                            onClick={envSaveTemplate}
                            disabled={envTmplSaving}
                            className="text-xs border border-border rounded-lg px-3 py-1.5 hover:bg-bg-hover disabled:opacity-40 text-fg-secondary shrink-0">
                            {envTmplSaving ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* Success state */
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-fg-primary">Envelope created</p>
                        <p className="text-xs text-fg-tertiary">Share the signing links below with each signer</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {envResult.links.map(link => (
                        <div key={link.email} className="border border-border rounded-xl p-3">
                          <p className="text-xs font-medium text-fg-primary">{link.name}</p>
                          <p className="text-xs text-fg-tertiary mb-2">{link.email}</p>
                          <div className="flex gap-2">
                            <input readOnly value={link.url}
                              className="flex-1 text-xs border border-border rounded px-2 py-1.5 bg-bg-surface text-fg-tertiary truncate" />
                            <button
                              onClick={async () => {
                                await navigator.clipboard.writeText(link.url)
                                setEnvCopied(link.email)
                                setTimeout(() => setEnvCopied(null), 2000)
                              }}
                              className="px-3 py-1.5 text-xs border border-border rounded hover:bg-bg-hover">
                              {envCopied === link.email ? '✓' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <a href={`/pdf/envelopes/${envResult.id}`}
                      className="block text-center text-xs text-accent hover:underline">
                      View envelope status →
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Footer navigation */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
              <button onClick={() => envStep > 0 ? setEnvStep(s => s - 1) : envReset()}
                className="text-sm text-fg-secondary border border-border rounded-lg px-4 py-2 hover:bg-bg-hover">
                {envStep === 0 ? 'Cancel' : '← Back'}
              </button>
              {!envResult && envStep < 2 && (
                <button
                  onClick={() => setEnvStep(s => s + 1)}
                  disabled={envStep === 0 && envRecips.length === 0}
                  className="text-sm bg-accent text-accent-fg rounded-lg px-4 py-2 hover:bg-accent-h disabled:opacity-40">
                  Continue →
                </button>
              )}
              {!envResult && envStep === 2 && (
                <button onClick={envSend} disabled={envSending}
                  className="text-sm bg-accent text-accent-fg rounded-lg px-4 py-2 hover:bg-accent-h disabled:opacity-40">
                  {envSending ? 'Sending…' : 'Send for signature →'}
                </button>
              )}
              {envResult && (
                <button onClick={envReset}
                  className="text-sm bg-accent text-accent-fg rounded-lg px-4 py-2 hover:bg-accent-h">
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Password protect modal ───────────────────────────────────────────── */}
      {protectOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-bg-raised rounded-xl border border-border shadow-card p-6 w-80">
            <h2 className="text-sm font-semibold text-fg-primary mb-1">Password Protect PDF</h2>
            <p className="text-xs text-fg-tertiary mb-4">Downloads an encrypted copy. Your working file is not modified.</p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-fg-tertiary">Password</span>
                <input type="password" value={protectPw} onChange={e => setProtectPw(e.target.value)}
                  placeholder="Enter password"
                  className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary" />
              </label>
              <label className="block">
                <span className="text-xs text-fg-tertiary">Confirm password</span>
                <input type="password" value={protectPwConfirm} onChange={e => setProtectPwConfirm(e.target.value)}
                  placeholder="Confirm password"
                  onKeyDown={e => { if (e.key === 'Enter') doProtect() }}
                  className="mt-0.5 w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-fg-primary" />
              </label>
              {protectPw && protectPwConfirm && protectPw !== protectPwConfirm && (
                <p className="text-xs text-danger">Passwords do not match</p>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setProtectOpen(false); setProtectPw(''); setProtectPwConfirm('') }}
                className="flex-1 text-sm text-fg-secondary border border-border rounded-lg py-2 hover:bg-bg-hover">Cancel</button>
              <button onClick={doProtect}
                disabled={protecting || !protectPw || protectPw !== protectPwConfirm}
                className="flex-1 bg-accent text-accent-fg text-sm rounded-lg py-2 hover:bg-accent-h disabled:opacity-40">
                {protecting ? 'Generating…' : 'Download Protected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
