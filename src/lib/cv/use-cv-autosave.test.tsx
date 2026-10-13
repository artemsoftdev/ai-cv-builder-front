import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Link from "next/link";
import { useForm, useFormState } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Cv, CvContent } from "@/lib/api/types";
import { isLeaving } from "@/lib/auth/session";
import { useCv } from "@/lib/query/cv-hooks";
import { queryKeys } from "@/lib/query/keys";
import { createQueryClient } from "@/lib/query/query-client";
import { errorResponse, jsonResponse, mockFetch } from "@/test/http";

import { readDraft } from "./drafts";
import type { CvSectionKey } from "./sections";
import { LEAVE_WITH_UNSAVED_EDITS, useCvAutosave } from "./use-cv-autosave";

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  isLeaving: vi.fn(() => false),
}));

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

type EditorProps = { callbacks: Callbacks; debounceMs: number; initial?: CvContent };

function Editor({ callbacks, debounceMs, initial }: EditorProps) {
  const query = useCv(CV_ID);
  const cv = query.data as Cv & { content: CvContent };
  const form = useForm<CvContent>({ defaultValues: structuredClone(initial ?? cv.content) });
  const autosave = useCvAutosave({ cv, refetch: query.refetch, form, debounceMs, ...callbacks });
  const { errors } = useFormState({ control: form.control });
  return (
    <>
      <output aria-label="Summary error">{errors.summary?.message}</output>
      <textarea aria-label="Summary" {...form.register("summary")} />
      <input aria-label="Link" {...form.register("contact.links.0.url")} />
      <output aria-label="Save status">{autosave.state.status}</output>
      <output aria-label="Invalid">{String(autosave.invalid)}</output>
      <Link href="/cvs">Your CVs</Link>
    </>
  );
}

let queryClient: QueryClient;

function renderEditor({ debounceMs = 10, initial }: { debounceMs?: number; initial?: CvContent } = {}) {
  queryClient = createQueryClient({ onUnauthorized: vi.fn() });
  queryClient.setQueryData(queryKeys.cv(CV_ID), makeCv());
  const callbacks = { onConflict: vi.fn(), onRemoteUpdate: vi.fn() };
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <Editor callbacks={callbacks} debounceMs={debounceMs} initial={initial} />
    </QueryClientProvider>,
  );
  const summary = () => screen.getByLabelText<HTMLTextAreaElement>("Summary");
  // One change event: typing char by char would interleave with the 10 ms debounce.
  const setSummary = (value: string) => fireEvent.input(summary(), { target: { value } });
  return { user, callbacks, summary, setSummary, unmount: view.unmount };
}

const savedCv = async (_input: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body)) as { version: number; content?: CvContent };
  return jsonResponse({ cv: makeCv({ version: body.version + 1, content: body.content ?? content() }) });
};

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

const patchCalls = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  setVisibility("visible");
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
    // Asserted on the payload: a save flushed by an earlier test's unmount may still land here.
    expect(patchCalls(fetchMock).filter(([, init]) => String(init?.body).includes("javascript:"))).toHaveLength(0);
  });

  it("shows the API's objection on the field it is about", async () => {
    mockFetch().mockImplementation(async (_input, init) =>
      init?.method === "PATCH"
        ? errorResponse(400, "VALIDATION_ERROR", "Invalid request", {
            issues: [{ path: "content.summary", message: "Summary is not allowed here" }],
          })
        : jsonResponse({ cv: makeCv() }),
    );
    const { setSummary } = renderEditor();

    setSummary("Rejected by the server");

    await waitFor(() => expect(screen.getByLabelText("Summary error")).toHaveTextContent("Summary is not allowed here"));
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

  it("highlights only what the server changed, not whitespace it normalised in our own save", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { version: number; content: CvContent };
      return jsonResponse({ cv: makeCv({ version: 2, content: { ...body.content, summary: body.content.summary.trim() } }) });
    });
    const { setSummary, callbacks } = renderEditor();

    setSummary("Trailing space ");
    await waitFor(() => expect(screen.getByLabelText("Save status")).toHaveTextContent("saved"));
    const rewritten = content("Trailing space");
    rewritten.contact.headline = "Staff Engineer";
    act(() => {
      queryClient.setQueryData(queryKeys.cv(CV_ID), makeCv({ version: 3, content: rewritten }));
    });

    await waitFor(() => expect(callbacks.onRemoteUpdate).toHaveBeenCalledExactlyOnceWith(["contact"]));
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
    const { setSummary, summary, callbacks } = renderEditor();

    setSummary("Original summary and laptop");

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
    const { setSummary, summary, callbacks } = renderEditor();

    setSummary("Original summary and laptop");

    await waitFor(() => expect(patches).toBe(2));
    await waitFor(() => expect(screen.getByLabelText("Save status")).toHaveTextContent("saved"));
    const retried = JSON.parse(String(patchCalls(fetchMock)[1]?.[1]?.body)) as { version: number; content: CvContent };
    expect(retried.version).toBe(3);
    expect(retried.content.summary).toBe("Original summary and laptop");
    expect(retried.content.contact.headline).toBe("Staff Engineer");
    expect(summary()).toHaveValue("Original summary and laptop");
    expect(callbacks.onConflict).toHaveBeenCalledExactlyOnceWith({ kept: ["summary"], dropped: [] });
  });

  it("lets the server win instead of resending a merge onto a version that keeps conflicting", async () => {
    const fetchMock = mockFetch();
    const remote = content();
    remote.contact.headline = "Staff Engineer";
    fetchMock.mockImplementation(async (_input, init) =>
      init?.method === "PATCH"
        ? errorResponse(409, "VERSION_CONFLICT", "Stale version", { currentVersion: 3 })
        : jsonResponse({ cv: makeCv({ version: 3, content: remote }) }),
    );
    const { setSummary, summary, callbacks } = renderEditor();

    setSummary("Original summary and laptop");

    await waitFor(() => expect(callbacks.onConflict).toHaveBeenCalledTimes(2));
    expect(callbacks.onConflict).toHaveBeenNthCalledWith(1, { kept: ["summary"], dropped: [] });
    expect(callbacks.onConflict).toHaveBeenNthCalledWith(2, { kept: [], dropped: ["summary"] });
    expect(summary()).toHaveValue("Original summary");
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(patchCalls(fetchMock)).toHaveLength(2);
  });
});

describe("useCvAutosave when leaving", () => {
  it.each([
    ["the tab is hidden", () => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    }],
    ["the page is unloaded", () => window.dispatchEvent(new Event("pagehide"))],
  ])("sends pending edits right away, with keepalive, when %s", async (_case, leave) => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(savedCv);
    const { setSummary } = renderEditor({ debounceMs: 60_000 });

    setSummary("Edited just before leaving");
    act(leave);

    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
    const [, init] = patchCalls(fetchMock)[0]!;
    expect(init?.keepalive).toBe(true);
    expect(JSON.parse(String(init?.body))).toMatchObject({ version: 1, content: { summary: "Edited just before leaving" } });
  });

  it("sends pending edits when the editor unmounts (in-app navigation)", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(savedCv);
    const { setSummary, unmount } = renderEditor({ debounceMs: 60_000 });

    setSummary("Edited, then went back to the list");
    unmount();

    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
  });

  it("asks before unloading with unsaved edits, but never holds up an auth redirect", () => {
    mockFetch().mockImplementation(savedCv);
    const { setSummary } = renderEditor({ debounceMs: 60_000 });
    const unload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(unload()).toBe(false);
    setSummary("Unsaved");
    expect(unload()).toBe(true);
    vi.mocked(isLeaving).mockReturnValue(true);
    expect(unload()).toBe(false);
  });

  it("asks before following an in-app link while edits can't be saved", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async (_input, init) =>
      init?.method === "PATCH" ? errorResponse(403, "CSRF_CHECK_FAILED", "Blocked") : jsonResponse({ cv: makeCv() }),
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { setSummary } = renderEditor();
    const follow = () => fireEvent.click(screen.getByRole("link", { name: "Your CVs" }));

    expect(follow()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();

    setSummary("Rejected edit");
    await waitFor(() => expect(screen.getByLabelText("Save status")).toHaveTextContent("error"));

    expect(follow()).toBe(false);
    expect(confirm).toHaveBeenCalledExactlyOnceWith(LEAVE_WITH_UNSAVED_EDITS);
  });
});

describe("useCvAutosave drafts", () => {
  it("keeps unsaved edits in a draft for this tab until the server has them", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(savedCv);
    const { setSummary } = renderEditor({ debounceMs: 200 });

    setSummary("Not saved yet");
    expect(readDraft(CV_ID)).toMatchObject({ version: 1, base: content(), content: { summary: "Not saved yet" } });

    await waitFor(() => expect(screen.getByLabelText("Save status")).toHaveTextContent("saved"));
    expect(patchCalls(fetchMock)).toHaveLength(1);
    expect(readDraft(CV_ID)).toBeNull();
  });

  it("keeps invalid edits in the draft too: they are still the user's work", () => {
    mockFetch();
    renderEditor();

    fireEvent.input(screen.getByLabelText("Link"), { target: { value: "javascript:alert(1)" } });

    expect(readDraft(CV_ID)?.content.contact.links[0]?.url).toBe("javascript:alert(1)");
  });

  it("saves a restored draft right away when the editor starts from one", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(savedCv);

    renderEditor({ debounceMs: 60_000, initial: content("Restored from before the reload") });

    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
    expect(JSON.parse(String(patchCalls(fetchMock)[0]![1]?.body))).toMatchObject({
      version: 1,
      content: { summary: "Restored from before the reload" },
    });
    await waitFor(() => expect(readDraft(CV_ID)).toBeNull());
  });
});
