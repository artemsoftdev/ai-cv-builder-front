// @vitest-environment node
import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

describe("next.config security headers", () => {
  it("send a Content-Security-Policy with pages only (the API sets its own headers)", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];

    expect(rules).toHaveLength(1);
    const [rule] = rules;
    expect(rule?.source).toBe("/((?!api/).*)");
    const csp = rule?.headers.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("send the browser only to same-origin /api/*, rewritten to the API", async () => {
    const rewrites = await nextConfig.rewrites?.();
    expect(rewrites).toEqual([
      { source: "/api/:path*", destination: expect.stringMatching(/^https?:\/\/[^/]+\/api\/:path\*$/) },
    ]);
  });
});
