import { describe, expect, it } from "vitest";

import { getGenerationSteps } from "./generation-steps";

const summary = (steps: ReturnType<typeof getGenerationSteps>) => steps.map((step) => `${step.stage}:${step.state}`);

describe("getGenerationSteps", () => {
  it("hides the scanned-PDF step for regular sources", () => {
    expect(summary(getGenerationSteps("drafting", false))).toEqual([
      "queued:complete",
      "drafting:current",
      "verifying:upcoming",
      "done:upcoming",
    ]);
  });

  it("shows the scanned-PDF step while it runs and after it was seen", () => {
    expect(summary(getGenerationSteps("extracting", false))).toEqual([
      "queued:complete",
      "extracting:current",
      "drafting:upcoming",
      "verifying:upcoming",
      "done:upcoming",
    ]);
    expect(summary(getGenerationSteps("verifying", true))).toContain("extracting:complete");
  });

  it("starts with the queue as the current step", () => {
    expect(getGenerationSteps("queued", false)[0]).toMatchObject({ label: "In queue", state: "current" });
  });
});
