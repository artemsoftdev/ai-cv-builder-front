import { notifyManager, QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CvSummary } from "@/lib/api/types";
import { CV_ID, makeCv } from "@/test/fixtures";
import { errorResponse, jsonResponse, mockFetch } from "@/test/http";

import { useCv, useCvs, useDeleteCv, useRetryCv } from "./cv-hooks";
import { queryKeys } from "./keys";
import { createQueryClient } from "./query-client";

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
const flush = () => act(() => vi.advanceTimersByTimeAsync(0));
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const gets = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === "GET").length;

const summary = (id: string, overrides: Partial<CvSummary> = {}): CvSummary => ({
  id,
  title: id,
  targetRole: "Engineer",
  status: "ready",
  stage: "done",
  busy: false,
  openQuestions: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

// React Query batches notifications with setTimeout(0); fake timers would hold them back.
beforeAll(() => notifyManager.setScheduler((callback) => void Promise.resolve().then(callback)));
afterAll(() => notifyManager.setScheduler((callback) => setTimeout(callback, 0)));

beforeEach(() => {
  vi.useFakeTimers();
  queryClient = createQueryClient({ onUnauthorized: vi.fn() });
});

afterEach(() => {
  queryClient.clear();
  vi.useRealTimers();
});

describe("useCv polling", () => {
  it("polls every 1.5 s while the CV is generating and stops once it is ready", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({ cv: makeCv({ status: "generating", content: null }) }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ cv: makeCv({ status: "generating", content: null }) }));
    fetchMock.mockResolvedValue(jsonResponse({ cv: makeCv() }));
    const { result } = renderHook(() => useCv(CV_ID), { wrapper });

    await flush();
    expect(result.current.data?.status).toBe("generating");
    await wait(1_600);
    expect(gets(fetchMock)).toBe(2);
    await wait(1_600);
    expect(result.current.data?.status).toBe("ready");
    expect(gets(fetchMock)).toBe(3);

    await wait(10_000);
    expect(gets(fetchMock)).toBe(3);
  });

  it("keeps polling while an answer is applied (busy)", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse({ cv: makeCv({ busy: true }) }));
    renderHook(() => useCv(CV_ID), { wrapper });

    await flush();
    await wait(1_600);
    await wait(1_600);
    await wait(1_600);
    expect(gets(fetchMock)).toBe(4);
  });

  it("stops for good on a 404 instead of polling a deleted CV", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({ cv: makeCv({ status: "generating", content: null }) }));
    fetchMock.mockResolvedValue(errorResponse(404, "NOT_FOUND", "CV not found"));
    const { result } = renderHook(() => useCv(CV_ID), { wrapper });

    await flush();
    await wait(1_600);
    expect(result.current.error).toMatchObject({ code: "NOT_FOUND" });
    await wait(10_000);
    expect(gets(fetchMock)).toBe(2);
  });
});

describe("useCvs polling", () => {
  it("refreshes the list every 4 s while anything is in progress", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [summary("a", { status: "generating" })] }));
    fetchMock.mockResolvedValue(jsonResponse({ items: [summary("a")] }));
    renderHook(() => useCvs(), { wrapper });

    await flush();
    await wait(4_100);
    await wait(20_000);
    expect(gets(fetchMock)).toBe(2);
  });
});

describe("CV mutations", () => {
  it("store the CV they return and mark the list stale", async () => {
    mockFetch().mockResolvedValue(jsonResponse({ cv: makeCv({ status: "generating" }) }, { status: 202 }));
    queryClient.setQueryData(queryKeys.cvs, [summary(CV_ID, { status: "failed" })]);
    const { result } = renderHook(() => useRetryCv(CV_ID), { wrapper });

    await act(() => result.current.mutateAsync());

    expect(queryClient.getQueryData(queryKeys.cv(CV_ID))).toMatchObject({ status: "generating" });
    expect(queryClient.getQueryState(queryKeys.cvs)?.isInvalidated).toBe(true);
  });

  it("reload the CV after a failure so the page shows the server state", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async (_input, init) =>
      init?.method === "POST" ? errorResponse(409, "INVALID_STATE", "Not failed") : jsonResponse({ cv: makeCv() }),
    );
    queryClient.setQueryData(queryKeys.cv(CV_ID), makeCv({ status: "failed" }));
    renderHook(() => useCv(CV_ID), { wrapper });
    const { result } = renderHook(() => useRetryCv(CV_ID), { wrapper });

    await act(() => result.current.mutateAsync().catch(() => undefined));
    await flush();

    expect(queryClient.getQueryData(queryKeys.cv(CV_ID))).toMatchObject({ status: "ready" });
  });
});

describe("useDeleteCv", () => {
  const ids = () => queryClient.getQueryData<CvSummary[]>(queryKeys.cvs)?.map((cv) => cv.id);

  it("removes the CV from the list at once and puts it back in place if the request fails", async () => {
    let fail: (response: Response) => void = () => undefined;
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async (_input, init) =>
      init?.method === "DELETE"
        ? new Promise<Response>((resolve) => (fail = resolve))
        : jsonResponse({ items: [summary("a"), summary("b"), summary("c")] }),
    );
    queryClient.setQueryData(queryKeys.cvs, [summary("a"), summary("b"), summary("c")]);
    const { result } = renderHook(() => useDeleteCv(), { wrapper });

    act(() => result.current.mutate("b"));
    await flush();
    expect(ids()).toEqual(["a", "c"]);

    fail(errorResponse(500, "INTERNAL", "Boom"));
    await flush();
    expect(result.current.isError).toBe(true);
    expect(ids()).toEqual(["a", "b", "c"]);
  });

  it("treats a 404 as deleted and drops the cached CV", async () => {
    mockFetch().mockImplementation(async (_input, init) =>
      init?.method === "DELETE" ? errorResponse(404, "NOT_FOUND", "Gone") : jsonResponse({ items: [summary("a")] }),
    );
    queryClient.setQueryData(queryKeys.cvs, [summary("a"), summary("b")]);
    queryClient.setQueryData(queryKeys.cv("b"), makeCv({ id: "b" }));
    const { result } = renderHook(() => useDeleteCv(), { wrapper });

    await act(() => result.current.mutateAsync("b"));
    await flush();

    expect(result.current.isSuccess).toBe(true);
    expect(queryClient.getQueryData(queryKeys.cv("b"))).toBeUndefined();
  });

  it("refetches the list once, after the last of several parallel deletes", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async (_input, init) =>
      init?.method === "DELETE" ? new Response(null, { status: 204 }) : jsonResponse({ items: [] }),
    );
    queryClient.setQueryData(queryKeys.cvs, [summary("a"), summary("b")]);
    renderHook(() => useCvs(), { wrapper });
    await flush();
    const before = gets(fetchMock);
    const { result } = renderHook(() => useDeleteCv(), { wrapper });

    await act(() => Promise.all([result.current.mutateAsync("a"), result.current.mutateAsync("b")]));
    await flush();

    expect(gets(fetchMock) - before).toBe(1);
  });
});
