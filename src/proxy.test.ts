// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

function run(path: string, { session = false } = {}) {
  const request = new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: session ? { cookie: "cvb_session=opaque-token" } : {},
  });
  const response = proxy(request);
  return { status: response.status, location: response.headers.get("location") };
}

describe("proxy", () => {
  it("sends signed-out visitors of app routes to /login with a next parameter", () => {
    expect(run("/cvs/abc?tab=questions")).toEqual({
      status: 307,
      location: "http://localhost:3000/login?next=%2Fcvs%2Fabc%3Ftab%3Dquestions",
    });
    expect(run("/cvs")).toEqual({ status: 307, location: "http://localhost:3000/login" });
  });

  it("lets requests with a session cookie through to app routes", () => {
    expect(run("/cvs", { session: true }).location).toBeNull();
  });

  it("sends signed-in users away from the auth pages, honouring a safe next", () => {
    expect(run("/login", { session: true }).location).toBe("http://localhost:3000/cvs");
    expect(run("/signup?next=/cvs/1", { session: true }).location).toBe("http://localhost:3000/cvs/1");
    expect(run("/login?next=//evil.example", { session: true }).location).toBe("http://localhost:3000/cvs");
    expect(run("/login?next=%2F.%2F%2Fevil.example", { session: true }).location).toBe("http://localhost:3000/cvs");
  });

  it("shows the auth pages to signed-out visitors", () => {
    expect(run("/login").location).toBeNull();
    expect(run("/signup").location).toBeNull();
  });
});
