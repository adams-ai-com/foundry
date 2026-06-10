import postgres from 'postgres'

let _sql: ReturnType<typeof postgres> | null = null

function getDb() {
  if (!_sql) {
    const url = process.env.FOUNDRY_PDF_DB_URL
    if (!url) throw new Error('FOUNDRY_PDF_DB_URL not set')
    _sql = postgres(url, { max: 5, idle_timeout: 20 })
  }
  return _sql
}

// Proxy target must be callable so tagged template literals (db`...`) work
export const db = new Proxy(
  (() => {}) as unknown as ReturnType<typeof postgres>,
  {
    get: (_, prop) => {
      const sql = getDb()
      const val = sql[prop as keyof typeof sql]
      return typeof val === 'function' ? (val as Function).bind(sql) : val
    },
    apply: (_target, _this, args) =>
      (getDb() as unknown as (...a: unknown[]) => unknown)(...args),
  }
) as ReturnType<typeof postgres>

// ── Typed row shapes ──────────────────────────────────────────────────────────

export interface EnvelopeRow {
  id: string
  job_id: string
  creator_id: string
  creator_name: string
  creator_email: string
  title: string
  status: 'sent' | 'partial' | 'complete' | 'voided'
  page_count: number
  created_at: Date
  expires_at: Date | null
  completed_at: Date | null
}

export interface RecipientRow {
  id: string
  envelope_id: string
  name: string
  email: string
  order_index: number
  required: boolean
  status: 'pending' | 'active' | 'signed' | 'declined' | 'voided'
  token: string
  token_used: boolean
  sent_at: Date | null
  viewed_at: Date | null
  signed_at: Date | null
  cert_fingerprint: string | null
  ip_address: string | null
  user_agent: string | null
}

export interface FieldRow {
  id: string
  envelope_id: string
  recipient_id: string
  page: number
  x0: number; y0: number; x1: number; y1: number
  field_type: 'signature' | 'initials' | 'date' | 'name'
  required: boolean
  completed: boolean
}

export interface EventRow {
  id: string
  envelope_id: string
  recipient_id: string | null
  event: string
  actor: string | null
  ip_address: string | null
  user_agent: string | null
  detail: Record<string, unknown>
  created_at: Date
}
