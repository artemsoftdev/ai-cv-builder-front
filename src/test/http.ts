import { vi } from "vitest";

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

export function errorResponse(
  status: number,
  code: string,
  message = "Error",
  details?: Record<string, unknown>,
  headers?: Record<string, string>,
): Response {
  return jsonResponse({ error: { code, message, ...(details ? { details } : {}) } }, { status, headers });
}

export function mockFetch() {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function fetchCall(fetchMock: ReturnType<typeof mockFetch>, index = 0) {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`fetch was not called ${index + 1} time(s)`);
  const [input, init = {}] = call;
  return { url: String(input), init, headers: new Headers(init.headers) };
}
