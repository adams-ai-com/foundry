import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Health check (Harbor blue-green liveness) — never gated
  if (pathname === '/api/health' || pathname === '/pdf/api/health') {
    return NextResponse.next()
  }

  // Signing pages and their API routes are token-gated, not session-gated
  if (pathname.startsWith('/sign/') || pathname.startsWith('/pdf/sign/') ||
      pathname.startsWith('/api/sign/') || pathname.startsWith('/pdf/api/sign/')) {
    return NextResponse.next()
  }

  if (!request.cookies.get('owl_session')) {
    return NextResponse.redirect(new URL('/login', 'https://foundry.adams-ai.com'))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
