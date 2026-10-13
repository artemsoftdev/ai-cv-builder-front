import { describe, expect, it } from "vitest";

import { authPageHref, isProtectedPath, safeNextPath } from "./paths";

describe("safeNextPath", () => {
  it.each([
    ["/cvs/123", "/cvs/123"],
    ["/cvs/123?tab=questions#q1", "/cvs/123?tab=questions#q1"],
    ["/cvs/../cvs/1", "/cvs/1"],
  ])("accepts same-origin path %s", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  it.each([
    [null],
    [""],
    ["cvs"],
    ["https://evil.example"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["javascript:alert(1)"],
    ["/\tevil"],
    ["/login"],
    ["/signup?next=/cvs"],
  ])("falls back to /cvs for %s", (raw) => {
    expect(safeNextPath(raw)).toBe("/cvs");
  });
});

describe("authPageHref", () => {
  it("keeps a useful next and drops the default or unsafe ones", () => {
    expect(authPageHref("/login", "/cvs/1")).toBe("/login?next=%2Fcvs%2F1");
    expect(authPageHref("/login", "/cvs")).toBe("/login");
    expect(authPageHref("/signup", "//evil.example")).toBe("/signup");
  });
});

describe("isProtectedPath", () => {
  it("matches the app routes only", () => {
    expect(isProtectedPath("/cvs")).toBe(true);
    expect(isProtectedPath("/cvs/new")).toBe(true);
    expect(isProtectedPath("/cvsx")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
  });
});
