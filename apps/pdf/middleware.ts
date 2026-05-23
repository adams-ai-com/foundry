import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  if (!request.cookies.get('foundry_session')) {
    return NextResponse.redirect(new URL('/login', 'https://foundry.adams-ai.com'))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
