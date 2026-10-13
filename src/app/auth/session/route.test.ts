// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { DELETE } from "./route";

const request = (headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost:3000/auth/session", {
    method: "DELETE",
    headers: { cookie: "cvb_session=stale", ...headers },
  });

describe("DELETE /auth/session", () => {
  it("expires the session cookie", () => {
    const response = DELETE(request({ "X-Requested-With": "XMLHttpRequest" }));

    expect(response.status).toBe(204);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^cvb_session=;/);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
  });

  it("refuses a request without the CSRF header, so other sites can't log users out", async () => {
    const response = DELETE(request());

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toMatchObject({ error: { code: "CSRF_CHECK_FAILED" } });
  });
});
