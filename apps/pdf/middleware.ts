import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Signing pages and their API routes are token-gated, not session-gated
  if (pathname.startsWith('/sign/') || pathname.startsWith('/pdf/sign/') ||
      pathname.startsWith('/api/sign/') || pathname.startsWith('/pdf/api/sign/')) {
    return NextResponse.next()
  }

  if (!request.cookies.get('foundry_session')) {
    return NextResponse.redirect(new URL('/login', 'https://foundry.adams-ai.com'))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
