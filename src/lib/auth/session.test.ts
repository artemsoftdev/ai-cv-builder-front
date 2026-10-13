import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCall, mockFetch } from "@/test/http";

type SessionModule = typeof import("./session");

let session: SessionModule;
let replace: ReturnType<typeof vi.fn<(url: string) => void>>;

beforeEach(async () => {
  vi.resetModules();
  session = await import("./session");
  replace = vi.fn<(url: string) => void>();
  session.browserNavigation.replace = replace;
  window.history.replaceState(null, "", "/cvs/abc?tab=questions");
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("handleSessionExpired", () => {
  it("clears the stale cookie, then the cache, then goes to /login with next", async () => {
    const fetchMock = mockFetch();
    const order: string[] = [];
    fetchMock.mockImplementation(async () => {
      order.push("clear cookie");
      return new Response(null, { status: 204 });
    });

    await session.handleSessionExpired(() => order.push("clear cache"));

    const { url, init, headers } = fetchCall(fetchMock);
    expect(url).toBe("/auth/session");
    expect(init.method).toBe("DELETE");
    expect(headers.get("X-Requested-With")).toBe("XMLHttpRequest");
    expect(order).toEqual(["clear cookie", "clear cache"]);
    expect(replace).toHaveBeenCalledExactlyOnceWith("/login?next=%2Fcvs%2Fabc%3Ftab%3Dquestions");
    expect(session.isLeaving()).toBe(true);
  });

  it("handles only the first of several 401s", async () => {
    mockFetch().mockResolvedValue(new Response(null, { status: 204 }));

    await Promise.all([session.handleSessionExpired(), session.handleSessionExpired()]);

    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("still redirects when the cookie can't be cleared (offline)", async () => {
    mockFetch().mockRejectedValue(new TypeError("Failed to fetch"));

    await session.handleSessionExpired();

    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("does nothing on the auth pages themselves", async () => {
    const fetchMock = mockFetch();
    window.history.replaceState(null, "", "/login");

    await session.handleSessionExpired();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("ignores 401s that arrive while another navigation is leaving the page", async () => {
    const fetchMock = mockFetch();

    session.leaveTo("/login");
    await session.handleSessionExpired();

    expect(replace).toHaveBeenCalledExactlyOnceWith("/login");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
