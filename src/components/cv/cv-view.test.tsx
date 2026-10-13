import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Cv } from "@/lib/api/types";
import { queryKeys } from "@/lib/query/keys";
import { createQueryClient } from "@/lib/query/query-client";
import { CV_ID, makeCv } from "@/test/fixtures";
import { errorResponse, jsonResponse, mockFetch } from "@/test/http";

import { CvView } from "./cv-view";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

let queryClient: QueryClient;

function renderView() {
  return render(
    <QueryClientProvider client={queryClient}>
      <CvView cvId={CV_ID} />
    </QueryClientProvider>,
  );
}

const generating = (overrides: Partial<Cv> = {}) =>
  makeCv({ status: "generating", stage: "drafting", content: null, review: null, version: 0, ...overrides });

beforeEach(() => {
  queryClient = createQueryClient({ onUnauthorized: vi.fn() });
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

describe("CvView", () => {
  it("shows a skeleton until the CV is loaded", () => {
    mockFetch().mockReturnValue(new Promise(() => undefined));
    renderView();
    expect(screen.getByRole("status")).toHaveTextContent("Loading your CV…");
  });

  it.each([
    [404, "NOT_FOUND"],
    [400, "VALIDATION_ERROR"],
  ])("treats %i %s as a CV that doesn't exist (or isn't ours)", async (status, code) => {
    mockFetch().mockResolvedValue(errorResponse(status, code, "Nope"));
    renderView();
    expect(await screen.findByRole("heading", { name: "CV not found" })).toBeInTheDocument();
  });

  it("offers to try again when the CV can't be loaded", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(errorResponse(429, "RATE_LIMITED", "Slow down"));
    fetchMock.mockResolvedValueOnce(jsonResponse({ cv: makeCv() }));
    renderView();

    expect(await screen.findByRole("heading", { name: "Couldn't load this CV" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("button", { name: /Backend CV, rename/ })).toBeInTheDocument();
  });

  it("shows progress while generating and opens the editor when the CV is ready", async () => {
    const success = vi.spyOn(toast, "success");
    mockFetch().mockResolvedValue(jsonResponse({ cv: generating() }));
    renderView();

    expect(await screen.findByRole("heading", { name: "Creating your CV" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Drafting with Claude");

    // What the next poll brings.
    act(() => queryClient.setQueryData(queryKeys.cv(CV_ID), makeCv()));

    const title = await screen.findByRole("button", { name: /Backend CV, rename/ });
    expect(success).toHaveBeenCalledWith("Your CV is ready", expect.anything());
    await waitFor(() => expect(title.closest("h1")).toHaveFocus());
  });

  it("restarts a failed generation and times the new run from the retry, even after a reload", async () => {
    const fetchMock = mockFetch();
    const failed = makeCv({ status: "failed", content: null, review: null, error: { code: "LLM_UNAVAILABLE", message: "" } });
    fetchMock.mockImplementation(async (_input, init) =>
      init?.method === "POST" ? jsonResponse({ cv: generating({ stage: "queued" }) }, { status: 202 }) : jsonResponse({ cv: failed }),
    );
    const view = renderView();

    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Creating your CV" })).toBeInTheDocument();
    // createdAt is months ago: timing from it would say this run is already slow.
    expect(screen.queryByText(/taking longer than usual/)).not.toBeInTheDocument();
    view.unmount();

    queryClient = createQueryClient({ onUnauthorized: vi.fn() });
    fetchMock.mockImplementation(async () => jsonResponse({ cv: generating() }));
    renderView();

    expect(await screen.findByRole("heading", { name: "Creating your CV" })).toBeInTheDocument();
    expect(screen.queryByText(/taking longer than usual/)).not.toBeInTheDocument();
  });

  it("explains a slow first run using the creation time", async () => {
    mockFetch().mockResolvedValue(jsonResponse({ cv: generating() }));
    renderView();
    expect(await screen.findByText(/taking longer than usual/)).toBeInTheDocument();
  });
});
