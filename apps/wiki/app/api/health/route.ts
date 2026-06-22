import { NextResponse } from 'next/server'

// Unauthenticated liveness endpoint for Harbor blue-green health checks.
// Served at <basePath>/api/health; excluded from the auth middleware.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 })
}
