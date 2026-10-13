import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Cv } from "@/lib/api/types";
import { createQueryClient } from "@/lib/query/query-client";
import { CV_ID, makeCv } from "@/test/fixtures";
import { errorResponse, fetchCall, jsonResponse, mockFetch } from "@/test/http";

import { GenerationFailed } from "./generation-failed";

const failedCv = (code: string, message = ""): Cv =>
  makeCv({ status: "failed", stage: "extracting", error: { code, message }, content: null, review: null });

function renderFailed(cv: Cv, onRetried = vi.fn()) {
  render(
    <QueryClientProvider client={createQueryClient({ onUnauthorized: vi.fn() })}>
      <GenerationFailed cv={cv} onRetried={onRetried} />
    </QueryClientProvider>,
  );
  return { onRetried };
}

describe("GenerationFailed", () => {
  it("shows the API's message once and retries a transient failure", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(
      jsonResponse({ cv: { ...failedCv("LLM_UNAVAILABLE"), status: "generating" } }, { status: 202 }),
    );
    const { onRetried } = renderFailed(
      failedCv("LLM_UNAVAILABLE", "The AI service is unavailable right now. Please try again in a few minutes."),
    );

    expect(screen.getAllByText(/AI service is unavailable right now/)).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(onRetried).toHaveBeenCalled());
    const { url, init, headers } = fetchCall(fetchMock);
    expect(url).toBe(`/api/cvs/${CV_ID}/retry`);
    expect(init.method).toBe("POST");
    expect(headers.get("X-Requested-With")).toBe("XMLHttpRequest");
  });

  it("trusts the API's specific message over the generic text for its code", () => {
    renderFailed(
      failedCv(
        "LLM_NOT_CONFIGURED",
        "AI generation is not configured correctly on the server (the API key was rejected).",
      ),
    );

    expect(screen.getByText(/the API key was rejected/)).toBeInTheDocument();
    expect(screen.queryByText(/ANTHROPIC_API_KEY is missing/)).not.toBeInTheDocument();
  });

  it("falls back to the text for the code when the message is empty", () => {
    renderFailed(failedCv("LLM_INVALID_OUTPUT"));
    expect(screen.getByText("The AI produced an unusable result. Retrying usually helps.")).toBeInTheDocument();
  });

  it("explains the generation limit when a retry is rate limited", async () => {
    mockFetch().mockResolvedValue(errorResponse(429, "RATE_LIMITED", "Too many", undefined, { "Retry-After": "600" }));
    const { onRetried } = renderFailed(failedCv("LLM_UNAVAILABLE"));
    const toast = await import("sonner").then((module) => vi.spyOn(module.toast, "error"));

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith("Couldn't restart the generation", {
        description: expect.stringMatching(/up to 10 CV generations per hour.*try again in 10 minutes/),
      }),
    );
    expect(onRetried).not.toHaveBeenCalled();
  });

  it("offers a new source instead of a pointless retry when the source is unreadable", () => {
    renderFailed(failedCv("SOURCE_UNREADABLE", "We couldn't read any text from your source."));

    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start with another source/ })).toHaveAttribute("href", "/cvs/new");
  });
});
