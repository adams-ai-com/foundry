import { NextResponse } from 'next/server'

// Unauthenticated liveness endpoint for Harbor blue-green health checks.
// With basePath '/pdf' this is served at /pdf/api/health. Allowlisted in
// middleware so the health probe is never redirected to /login.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 })
}
