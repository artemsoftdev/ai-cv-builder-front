import { describe, expect, it } from "vitest";

import { safeHref } from "./safe-url";

describe("safeHref", () => {
  it.each([
    ["https://github.com/jane", "https://github.com/jane"],
    ["github.com/jane", "https://github.com/jane"],
    ["mailto:jane@example.com", "mailto:jane@example.com"],
    ["  https://x.dev  ", "https://x.dev/"],
  ])("allows %s", (raw, expected) => {
    expect(safeHref(raw)).toBe(expected);
  });

  it.each([["javascript:alert(1)"], ["JaVaScRiPt:alert(1)"], ["data:text/html,<script>"], ["vbscript:x"], [""]])(
    "blocks %s",
    (raw) => {
      expect(safeHref(raw)).toBeNull();
    },
  );
});
