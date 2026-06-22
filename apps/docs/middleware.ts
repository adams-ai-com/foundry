import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  if (!request.cookies.get("foundry_session")) {
    return new NextResponse(null, { status: 307, headers: { Location: `${new URL(request.url).origin}/login` } })
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
