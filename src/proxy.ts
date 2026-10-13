import { NextResponse, type NextRequest } from "next/server";

import { authPageHref, isAuthPage, isProtectedPath, LOGIN_PATH, safeNextPath, SESSION_COOKIE } from "@/lib/auth/paths";

// Optimistic guard: only checks that the session cookie exists; the API decides whether it is valid.
export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (isAuthPage(pathname)) {
    return hasSession
      ? NextResponse.redirect(new URL(safeNextPath(searchParams.get("next")), request.url))
      : NextResponse.next();
  }

  if (!hasSession && isProtectedPath(pathname)) {
    return NextResponse.redirect(new URL(authPageHref(LOGIN_PATH, `${pathname}${search}`), request.url));
  }
  return NextResponse.next();
}

export const config = {
  // /api/* is excluded: the API authenticates itself, and the proxy would make Next buffer uploads.
  matcher: ["/cvs/:path*", "/login", "/signup"],
};
