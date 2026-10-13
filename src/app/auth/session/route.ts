import { NextResponse, type NextRequest } from "next/server";

import { CSRF_HEADER } from "@/lib/api/client";
import { SESSION_COOKIE } from "@/lib/auth/paths";

// Expires a cookie the API rejected; the proxy only checks that one exists.
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
