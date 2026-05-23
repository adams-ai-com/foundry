import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  if (!request.cookies.get("foundry_session")) {
    const res = NextResponse.redirect(new URL("/login", "https://foundry.adams-ai.com"))
    res.cookies.set("foundry_return_to", request.nextUrl.pathname + request.nextUrl.search, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    })
    return res
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
}
