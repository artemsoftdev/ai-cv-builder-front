import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Cv, CvContent } from "@/lib/api/types";
import { writeDraft } from "@/lib/cv/drafts";
import { useCv } from "@/lib/query/cv-hooks";
import { queryKeys } from "@/lib/query/keys";
import { createQueryClient } from "@/lib/query/query-client";
import { saveFile } from "@/lib/utils/save-file";
import { CV_ID, makeContent, makeCv } from "@/test/fixtures";
import { jsonResponse, mockFetch } from "@/test/http";

import type { ReadyCv } from "@/lib/cv/ready-cv";

import { CvWorkspace } from "./cv-workspace";

// Like Next, useSearchParams follows history.replaceState (the phone tabs live in ?tab=).
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const listeners = new Set<() => void>();
  const replaceState = window.history.replaceState.bind(window.history);
  window.history.replaceState = (...args: Parameters<History["replaceState"]>) => {
    replaceState(...args);
    listeners.forEach((listener) => listener());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return {
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(
          subscribe,
          () => window.location.search,
          () => "",
        ),
      ),
  };
});
vi.mock("@/lib/utils/save-file", () => ({ saveFile: vi.fn() }));

let queryClient: QueryClient;

function Workspace() {
  const query = useCv(CV_ID);
  return query.data ? <CvWorkspace cv={query.data as ReadyCv} refetch={query.refetch} refetchFailed={false} /> : null;
}

function renderWorkspace(cv: Cv = makeCv()) {
  queryClient.setQueryData(queryKeys.cv(CV_ID), cv);
  render(
    <QueryClientProvider client={queryClient}>
      <Workspace />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

// The API answers PATCH with the saved CV and GET /pdf with a file.
function apiStub(calls: string[]) {
  const fetchMock = mockFetch();
  fetchMock.mockImplementation(async (input, init) => {
    const method = init?.method ?? "GET";
    calls.push(`${method} ${String(input)}`);
    if (method === "PATCH") {
      const body = JSON.parse(String(init?.body)) as { version: number; content?: CvContent };
      return jsonResponse({ cv: makeCv({ version: body.version + 1, content: body.content ?? makeContent() }) });
    }
    if (String(input).endsWith("/pdf")) {
      return new Response("%PDF", {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="Jane.pdf"' },
      });
    }
    return jsonResponse({ cv: makeCv() });
  });
  return fetchMock;
}

beforeEach(() => {
  queryClient = createQueryClient({ onUnauthorized: vi.fn() });
  sessionStorage.clear();
  window.history.replaceState(null, "", "/cvs/1");
  vi.mocked(saveFile).mockClear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

const summary = () => screen.getByRole("textbox", { name: "Professional summary" });

describe("CvWorkspace", () => {
  it("saves pending edits before downloading the PDF, which is made from the saved copy", async () => {
    const calls: string[] = [];
    apiStub(calls);
    const user = renderWorkspace();

    fireEvent.input(summary(), { target: { value: "Typed a moment ago" } });
    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() => expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), "Jane.pdf"));
    expect(calls.filter((call) => call !== `GET /api/cvs/${CV_ID}`)).toEqual([
      `PATCH /api/cvs/${CV_ID}`,
      `GET /api/cvs/${CV_ID}/pdf`,
    ]);
  });

  it("does not download while a field is invalid and takes the user to it", async () => {
    const calls: string[] = [];
    apiStub(calls);
    const error = vi.spyOn(toast, "error");
    const user = renderWorkspace();

    fireEvent.input(summary(), { target: { value: "x".repeat(1_600) } });
    await user.click(screen.getByRole("tab", { name: /Preview/ }));
    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    expect(error).toHaveBeenCalledWith("Fix the highlighted fields first", expect.anything());
    await waitFor(() => expect(summary()).toHaveFocus());
    expect(screen.getByRole("tab", { name: /Edit/ })).toHaveAttribute("aria-selected", "true");
    expect(calls.some((call) => call.includes("/pdf") || call.startsWith("PATCH"))).toBe(false);
  });

  it("starts from edits this tab could not save before a reload, and saves them", async () => {
    const calls: string[] = [];
    apiStub(calls);
    const info = vi.spyOn(toast, "info");
    writeDraft(CV_ID, {
      version: 3,
      base: makeContent(),
      content: makeContent({ summary: "Unsaved before the reload" }),
    });

    renderWorkspace();

    expect(summary()).toHaveValue("Unsaved before the reload");
    expect(info).toHaveBeenCalledWith("Restored your unsaved edits", expect.anything());
    await waitFor(() => expect(calls).toContain(`PATCH /api/cvs/${CV_ID}`));
  });

  it("is read-only while Claude applies an answer", () => {
    apiStub([]);
    renderWorkspace(makeCv({ busy: true }));

    expect(summary()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeDisabled();
    expect(screen.getByText("Updating your CV with your answer…")).toBeInTheDocument();
  });
});
