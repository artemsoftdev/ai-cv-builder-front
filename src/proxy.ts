import { NextResponse, type NextRequest } from "next/server";

import { authPageHref, isAuthPage, LOGIN_PATH, safeNextPath, SESSION_COOKIE } from "@/lib/auth/paths";

/**
 * Optimistic route guard (Next 16 "proxy", formerly middleware). It only checks that the
 * session cookie is *present*, which costs nothing and avoids flashing protected pages to
 * signed-out visitors. Whether the session is valid is decided by the API: the client calls
 * GET /api/auth/me and any 401 sends the user to /login (clearing a stale cookie first).
 */
export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (isAuthPage(pathname)) {
    return hasSession
      ? NextResponse.redirect(new URL(safeNextPath(searchParams.get("next")), request.url))
      : NextResponse.next();
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL(authPageHref(LOGIN_PATH, `${pathname}${search}`), request.url));
  }
  return NextResponse.next();
}

export const config = {
  // App routes + auth pages only. `/api/*` is deliberately excluded: the API authenticates
  // itself, and running the proxy would make Next buffer upload bodies.
  matcher: ["/cvs/:path*", "/login", "/signup"],
};
