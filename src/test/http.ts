import { vi } from "vitest";

/** A `Response` with a JSON body. */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

/** The API's error envelope (docs/API.md, "Errors"). */
export function errorResponse(
  status: number,
  code: string,
  message = "Error",
  details?: Record<string, unknown>,
  headers?: Record<string, string>,
): Response {
  return jsonResponse({ error: { code, message, ...(details ? { details } : {}) } }, { status, headers });
}

/** Replaces global fetch with a mock for the current test (restored by `unstubGlobals`). */
export function mockFetch() {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Headers and init of the n-th fetch call. */
export function fetchCall(fetchMock: ReturnType<typeof mockFetch>, index = 0) {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`fetch was not called ${index + 1} time(s)`);
  const [input, init = {}] = call;
  return { url: String(input), init, headers: new Headers(init.headers) };
}
