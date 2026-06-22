import { NextResponse } from 'next/server'

// Unauthenticated liveness endpoint for Harbor blue-green health checks.
// No basePath and no auth middleware → served at /api/health.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 })
}
