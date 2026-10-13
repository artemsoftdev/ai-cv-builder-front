import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { SaveState } from "@/lib/cv/save-queue";

import { SaveStatus } from "./save-status";

const apiError = (status: number, code: string, details?: Record<string, unknown>) =>
  new ApiError({ status, code, message: `${code} message`, details });

function renderStatus(state: SaveState, invalid = false) {
  const onRetry = vi.fn();
  render(<SaveStatus state={state} invalid={invalid} onRetry={onRetry} />);
  return { onRetry, announced: () => screen.getByRole("status").textContent };
}

describe("SaveStatus", () => {
  it("stays quiet for screen readers while saving normally", () => {
    const { announced } = renderStatus({ status: "saving" });
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(announced()).toBe("");
  });

  it("offers a retry for transient failures and announces them", async () => {
    const { onRetry, announced } = renderStatus({ status: "error", error: apiError(0, "NETWORK_ERROR"), willRetry: false });

    expect(announced()).toBe("Couldn't save");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("says why the server rejected a save instead of offering a blind retry", () => {
    const error = apiError(400, "VALIDATION_ERROR", {
      issues: [{ path: "content.summary", message: "Too long" }],
    });
    const { announced } = renderStatus({ status: "error", error, willRetry: false });

    expect(announced()).toBe("Couldn't save: Too long");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("asks to fix invalid fields", () => {
    const { announced } = renderStatus({ status: "saved" }, true);
    expect(announced()).toBe("Fix the highlighted fields to save");
  });

  it("offers a reload while a conflict can't be resolved", () => {
    renderStatus({ status: "conflict" });
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });
});
