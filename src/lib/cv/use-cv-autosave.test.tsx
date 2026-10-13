import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Cv, CvContent } from "@/lib/api/types";
import { useCv } from "@/lib/query/cv-hooks";
import { queryKeys } from "@/lib/query/keys";
import { createQueryClient } from "@/lib/query/query-client";
import { errorResponse, jsonResponse, mockFetch } from "@/test/http";

import type { CvSectionKey } from "./sections";
import { useCvAutosave } from "./use-cv-autosave";

const CV_ID = "11111111-1111-4111-8111-111111111111";

const content = (summary = "Original summary"): CvContent => ({
  contact: {
    fullName: "Jane Doe",
    headline: "Engineer",
    email: "",
    phone: "",
    location: "",
    links: [{ id: "l1", label: "GitHub", url: "github.com/jane" }],
  },
  summary,
  experience: [],
  education: [],
  skills: [],
});

const makeCv = (overrides: Partial<Cv> = {}): Cv => ({
  id: CV_ID,
  title: "My CV",
  targetRole: "Engineer",
  sourceType: "text",
  sourceFilename: null,
  status: "ready",
  stage: "done",
  error: null,
  content: content(),
  review: { flags: [], removed: [], evidence: {} },
  questions: [],
  version: 1,
  busy: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

type Callbacks = { onConflict: () => void; onRemoteUpdate: (sections: CvSectionKey[]) => void };

function Editor({ callbacks, debounceMs }: { callbacks: Callbacks; debounceMs: number }) {
  const query = useCv(CV_ID);
  const cv = query.data as Cv & { content: CvContent };
  const form = useForm<CvContent>({ defaultValues: structuredClone(cv.content) });
  const autosave = useCvAutosave({ cv, refetch: query.refetch, form, debounceMs, ...callbacks });
  return (
    <>
      <textarea aria-label="Summary" {...form.register("summary")} />
      <input aria-label="Link" {...form.register("contact.links.0.url")} />
      <output aria-label="Save status">{autosave.state.status}</output>
      <output aria-label="Invalid">{String(autosave.invalid)}</output>
    </>
  );
}

let queryClient: QueryClient;

function renderEditor({ debounceMs = 10 } = {}) {
  queryClient = createQueryClient({ onUnauthorized: vi.fn() });
  queryClient.setQueryData(queryKeys.cv(CV_ID), makeCv());
  const callbacks = { onConflict: vi.fn(), onRemoteUpdate: vi.fn() };
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <Editor callbacks={callbacks} debounceMs={debounceMs} />
    </QueryClientProvider>,
  );
  return { user, callbacks, summary: () => screen.getByLabelText<HTMLTextAreaElement>("Summary") };
}

const patchCalls = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useCvAutosave", () => {
  it("PATCHes valid edits once the user pauses, with the current version", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async () => jsonResponse({ cv: makeCv({ version: 2, content: content("Updated") }) }));
    const { user, summary } = renderEditor();

    await user.clear(summary());
    await user.type(summary(), "Updated");

    await waitFor(() => expect(screen.getByLabelText("Save status")).toHaveTextContent("saved"));
    const calls = patchCalls(fetchMock);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(String(calls.at(-1)?.[1]?.body)) as { version: number; content: CvContent };
    expect(body.content.summary).toBe("Updated");
    expect(calls.map(([, init]) => (JSON.parse(String(init?.body)) as { version: number }).version)[0]).toBe(1);
    // Our own save must not be mistaken for a remote change.
    expect(summary()).toHaveValue("Updated");
  });

  it("does not send content that fails validation", async () => {
    const fetchMock = mockFetch();
    const { user } = renderEditor();

    // Pasted in one go: typing it would pass through valid values ("javascript") that get saved.
    await user.tripleClick(screen.getByLabelText("Link"));
    await user.paste("javascript:alert(1)");

    await waitFor(() => expect(screen.getByLabelText("Invalid")).toHaveTextContent("true"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(patchCalls(fetchMock)).toHaveLength(0);
  });

  it("loads newer server content (an applied answer) into a clean form", async () => {
    mockFetch();
    const { summary, callbacks } = renderEditor();

    act(() => {
      queryClient.setQueryData(queryKeys.cv(CV_ID), makeCv({ version: 2, content: content("Rewritten by Claude") }));
    });

    await waitFor(() => expect(summary()).toHaveValue("Rewritten by Claude"));
    expect(callbacks.onRemoteUpdate).toHaveBeenCalledWith(["summary"]);
  });

  it("keeps unsaved local edits when newer server content arrives", async () => {
    mockFetch();
    const { user, summary, callbacks } = renderEditor({ debounceMs: 60_000 });

    await user.type(summary(), " plus my edit");
    act(() => {
      queryClient.setQueryData(queryKeys.cv(CV_ID), makeCv({ version: 2, content: content("Rewritten by Claude") }));
    });

    expect(summary()).toHaveValue("Original summary plus my edit");
    expect(callbacks.onRemoteUpdate).not.toHaveBeenCalled();
  });

  it("on CV_BUSY keeps the edit and sends it again once the job has finished", async () => {
    const fetchMock = mockFetch();
    let patches = 0;
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method !== "PATCH") return jsonResponse({ cv: makeCv({ busy: false }) });
      patches += 1;
      return patches === 1
        ? errorResponse(409, "CV_BUSY", "A job is running")
        : jsonResponse({ cv: makeCv({ version: 2, content: content("Original summary!") }) });
    });
    const { user, summary } = renderEditor();

    await user.type(summary(), "!");

    await waitFor(() => expect(patches).toBe(2));
    await waitFor(() => expect(screen.getByLabelText("Save status")).toHaveTextContent("saved"));
    const lastBody = JSON.parse(String(patchCalls(fetchMock).at(-1)?.[1]?.body)) as { version: number; content: CvContent };
    expect(lastBody).toMatchObject({ version: 1, content: { summary: "Original summary!" } });
    expect(summary()).toHaveValue("Original summary!");
  });

  it("on VERSION_CONFLICT reloads the latest version into the form", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async (_input, init) =>
      init?.method === "PATCH"
        ? errorResponse(409, "VERSION_CONFLICT", "Stale version", { currentVersion: 3 })
        : jsonResponse({ cv: makeCv({ version: 3, content: content("Edited on my phone") }) }),
    );
    const { user, summary, callbacks } = renderEditor();

    await user.type(summary(), " and laptop");

    await waitFor(() => expect(summary()).toHaveValue("Edited on my phone"));
    expect(callbacks.onConflict).toHaveBeenCalledExactlyOnceWith({ kept: [], dropped: ["summary"] });
    expect(screen.getByLabelText("Save status")).toHaveTextContent("saved");
    // The server copy won and nothing else was sent.
    expect(patchCalls(fetchMock)).toHaveLength(1);
  });

  it("on VERSION_CONFLICT re-applies edits to parts only changed here and saves them on the new version", async () => {
    const fetchMock = mockFetch();
    const remote = content();
    remote.contact.headline = "Staff Engineer";
    let patches = 0;
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method !== "PATCH") return jsonResponse({ cv: makeCv({ version: 3, content: remote }) });
      patches += 1;
      if (patches === 1) return errorResponse(409, "VERSION_CONFLICT", "Stale version", { currentVersion: 3 });
      const body = JSON.parse(String(init.body)) as { content: CvContent };
      return jsonResponse({ cv: makeCv({ version: 4, content: body.content }) });
    });
    const { user, summary, callbacks } = renderEditor();

    await user.type(summary(), " and laptop");

    await waitFor(() => expect(patches).toBe(2));
    await waitFor(() => expect(screen.getByLabelText("Save status")).toHaveTextContent("saved"));
    const retried = JSON.parse(String(patchCalls(fetchMock)[1]?.[1]?.body)) as { version: number; content: CvContent };
    expect(retried.version).toBe(3);
    expect(retried.content.summary).toBe("Original summary and laptop");
    expect(retried.content.contact.headline).toBe("Staff Engineer");
    expect(summary()).toHaveValue("Original summary and laptop");
    expect(callbacks.onConflict).toHaveBeenCalledExactlyOnceWith({ kept: ["summary"], dropped: [] });
  });
});
