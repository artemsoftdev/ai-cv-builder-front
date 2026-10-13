import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Cv } from "@/lib/api/types";
import { createQueryClient } from "@/lib/query/query-client";
import { fetchCall, jsonResponse, mockFetch } from "@/test/http";

import { GenerationFailed } from "./generation-failed";

const failedCv = (code: string, message = ""): Cv => ({
  id: "33333333-3333-4333-8333-333333333333",
  title: "Data Analyst",
  targetRole: "Data Analyst",
  sourceType: "pdf",
  sourceFilename: "scan.pdf",
  status: "failed",
  stage: "extracting",
  error: { code, message },
  content: null,
  review: null,
  questions: [],
  version: 0,
  busy: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

function renderFailed(cv: Cv, onRetried = vi.fn()) {
  render(
    <QueryClientProvider client={createQueryClient({ onUnauthorized: vi.fn() })}>
      <GenerationFailed cv={cv} onRetried={onRetried} />
    </QueryClientProvider>,
  );
  return { onRetried };
}

describe("GenerationFailed", () => {
  it("retries a transient failure and shows the server's extra details", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse({ cv: { ...failedCv("LLM_UNAVAILABLE"), status: "generating" } }, { status: 202 }));
    const { onRetried } = renderFailed(failedCv("LLM_UNAVAILABLE", "Claude is overloaded (529)."));

    expect(screen.getByText(/AI service is unavailable right now/)).toBeInTheDocument();
    expect(screen.getByText("Claude is overloaded (529).")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(onRetried).toHaveBeenCalled());
    const { url, init, headers } = fetchCall(fetchMock);
    expect(url).toBe("/api/cvs/33333333-3333-4333-8333-333333333333/retry");
    expect(init.method).toBe("POST");
    expect(headers.get("X-Requested-With")).toBe("XMLHttpRequest");
  });

  it("offers a new source instead of a pointless retry when the source is unreadable", () => {
    renderFailed(failedCv("SOURCE_UNREADABLE", "We couldn't read any text from your source."));

    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start with another source/ })).toHaveAttribute("href", "/cvs/new");
  });
});
