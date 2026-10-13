import { NextResponse, type NextRequest } from "next/server";

import { CSRF_HEADER } from "@/lib/api/client";
import { SESSION_COOKIE } from "@/lib/auth/paths";

/**
 * DELETE /auth/session - expires the HttpOnly session cookie on this origin.
 * The client calls it after the API answered 401 for a cookie it no longer accepts; without
 * it the proxy (which only checks that the cookie exists) would keep bouncing between
 * /login and /cvs. The custom header requirement keeps cross-site pages from logging users out.
 */
export function DELETE(request: NextRequest) {
  if (request.headers.get(CSRF_HEADER.name) !== CSRF_HEADER.value) {
    return NextResponse.json(
      { error: { code: "CSRF_CHECK_FAILED", message: "Missing X-Requested-With header." } },
      { status: 403 },
    );
  }
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
