import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import { db } from '@/lib/db'

const DEFAULT_COLOR = '#2563eb'

// ── GET /api/envelope-branding — load creator's branding settings ─────────────

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [row] = await db`
    SELECT display_name, logo_url, brand_color
    FROM signing_branding WHERE creator_id = ${session.userId}
  `
  return NextResponse.json({
    display_name: row?.display_name ?? '',
    logo_url: row?.logo_url ?? '',
    brand_color: row?.brand_color ?? DEFAULT_COLOR,
  })
}

// ── PATCH /api/envelope-branding — save creator's branding settings ───────────

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { display_name?: string; logo_url?: string; brand_color?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const display_name = (body.display_name ?? '').trim().slice(0, 120)
  const logo_url = (body.logo_url ?? '').trim().slice(0, 512)
  const brand_color = /^#[0-9a-fA-F]{6}$/.test(body.brand_color ?? '')
    ? body.brand_color!
    : DEFAULT_COLOR

  await db`
    INSERT INTO signing_branding (creator_id, display_name, logo_url, brand_color, updated_at)
    VALUES (${session.userId}, ${display_name}, ${logo_url}, ${brand_color}, now())
    ON CONFLICT (creator_id) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          logo_url     = EXCLUDED.logo_url,
          brand_color  = EXCLUDED.brand_color,
          updated_at   = now()
  `

  return NextResponse.json({ display_name, logo_url, brand_color })
}
