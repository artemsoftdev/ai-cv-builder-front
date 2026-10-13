import { describe, expect, it } from "vitest";

import { showsTargetRole } from "./target-role";

describe("showsTargetRole", () => {
  it("hides the role while the title is still the default", () => {
    expect(showsTargetRole("Senior Backend Engineer", "Senior Backend Engineer")).toBe(false);
    expect(showsTargetRole(" senior backend engineer ", "Senior Backend Engineer")).toBe(false);
  });

  it("shows the role once the CV is renamed", () => {
    expect(showsTargetRole("Fintech applications", "Senior Backend Engineer")).toBe(true);
  });
});
