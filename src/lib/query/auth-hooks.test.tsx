import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { browserNavigation } from "@/lib/auth/session";
import { readDraft, writeDraft } from "@/lib/cv/drafts";
import { registerFlush } from "@/lib/cv/pending-saves";
import { CV_ID, makeContent } from "@/test/fixtures";
import { fetchCall, jsonResponse, mockFetch } from "@/test/http";

import { useLogin, useLogout } from "./auth-hooks";
import { queryKeys } from "./keys";
import { createQueryClient } from "./query-client";

let queryClient: QueryClient;
const onUnauthorized = vi.fn();
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  queryClient = createQueryClient({ onUnauthorized });
  onUnauthorized.mockReset();
  sessionStorage.clear();
});

describe("useLogout", () => {
  it("saves pending edits first, then ends the session and forgets everything local", async () => {
    const replace = vi.spyOn(browserNavigation, "replace").mockImplementation(() => undefined);
    const fetchMock = mockFetch();
    const order: string[] = [];
    const unregister = registerFlush(async () => {
      order.push("flush");
      return true;
    });
    fetchMock.mockImplementation(async () => {
      order.push("logout");
      return new Response(null, { status: 204 });
    });
    writeDraft(CV_ID, { version: 1, base: makeContent(), content: makeContent() });
    queryClient.setQueryData(queryKeys.me, { id: "u1" });
    const { result } = renderHook(() => useLogout(), { wrapper });

    act(() => result.current.mutate());

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    unregister();
    expect(order).toEqual(["flush", "logout"]);
    expect(fetchCall(fetchMock).url).toBe("/api/auth/logout");
    expect(readDraft(CV_ID)).toBeNull();
    expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();
  });

  it("reports other failures", async () => {
    mockFetch().mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useLogout(), { wrapper });

    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: "NETWORK_ERROR" });
  });
});

describe("useLogin", () => {
  it("drops data cached for another user and drafts owned by another account", async () => {
    writeDraft(CV_ID, { version: 1, base: makeContent(), content: makeContent() });
    sessionStorage.setItem("cvb:draft-owner", "someone-else");
    queryClient.setQueryData(queryKeys.cvs, [{ id: "theirs" }]);
    mockFetch().mockResolvedValue(jsonResponse({ user: { id: "u1", email: "jane@example.com", createdAt: "" } }));
    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(() => result.current.mutateAsync({ email: "jane@example.com", password: "long-enough" }));

    expect(queryClient.getQueryData(queryKeys.cvs)).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.me)).toMatchObject({ id: "u1" });
    expect(readDraft(CV_ID)).toBeNull();
  });
});
