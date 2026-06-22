import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const sessionId = request.cookies.get('foundry_session')?.value
  // Structural check: session IDs are UUID v4 (36 chars) or similar random strings
  if (!sessionId || sessionId.length < 20 || sessionId.length > 200) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  // Exclude: Next.js internals, all API routes (self-authenticated via getSession),
  // PWA assets (sw.js, manifest.json, icons), and login/logout pages
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api/|icons/|manifest\\.json|sw\\.js|badge-|login|logout).*)',
  ],
}
