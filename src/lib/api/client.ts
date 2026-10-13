import { ApiError, parseErrorBody, parseRetryAfter } from "./errors";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type ApiRequestOptions = {
  method?: HttpMethod;
  json?: unknown;
  formData?: FormData;
  accept?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  keepalive?: boolean;
};

export const CSRF_HEADER = { name: "X-Requested-With", value: "XMLHttpRequest" } as const;

export const DEFAULT_TIMEOUT_MS = 30_000;

const NETWORK_ERROR_MESSAGE = "Can't reach the server. Check your connection and try again.";
const TIMEOUT_MESSAGE = "The server took too long to answer. Check your connection and try again.";

// DOMException is not an Error subclass in every runtime.
function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function fallbackMessage(status: number): string {
  return status >= 500
    ? "The server ran into a problem. Please try again in a moment."
    : `The request failed (HTTP ${status}).`;
}

async function toApiError(response: Response): Promise<ApiError> {
  const retryAfterSeconds = parseRetryAfter(response.headers.get("Retry-After"));
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const parsed = parseErrorBody(body);
  if (parsed) {
    return new ApiError({ status: response.status, ...parsed, retryAfterSeconds });
  }
  // E.g. an HTML 502 page from a proxy while the API is restarting.
  return new ApiError({
    status: response.status,
    code: "INTERNAL",
    message: fallbackMessage(response.status),
    retryAfterSeconds,
  });
}

// The deadline also covers reading the body: a stalled response must not hang autosave forever.
async function request<T>(path: string, options: ApiRequestOptions, read: (response: Response) => Promise<T>): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers({ Accept: options.accept ?? "application/json" });
  let body: BodyInit | undefined;
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  } else if (options.formData) {
    body = options.formData;
  }
  if (method !== "GET") headers.set(CSRF_HEADER.name, CSRF_HEADER.value);

  const controller = new AbortController();
  const caller = options.signal;
  const forwardAbort = () => controller.abort(caller?.reason);
  if (caller?.aborted) forwardAbort();
  else caller?.addEventListener("abort", forwardAbort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const toRequestError = (error: unknown) => {
    if (error instanceof ApiError) return error;
    if (timedOut) return new ApiError({ status: 0, code: "NETWORK_ERROR", message: TIMEOUT_MESSAGE });
    if (caller?.aborted || isAbortError(error)) return error;
    return new ApiError({ status: 0, code: "NETWORK_ERROR", message: NETWORK_ERROR_MESSAGE });
  };

  try {
    const response = await fetch(path, {
      method,
      headers,
      body,
      credentials: "same-origin",
      // Polling must always see fresh state.
      cache: "no-store",
      keepalive: options.keepalive,
      signal: controller.signal,
    });
    if (!response.ok) throw await toApiError(response);
    return await read(response);
  } catch (error) {
    throw toRequestError(error);
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener("abort", forwardAbort);
  }
}

export function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return request(path, options, async (response) => {
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError({ status: response.status, code: "INTERNAL", message: "The server sent an unexpected response." });
    }
  });
}

export type DownloadedFile = { blob: Blob; filename: string | null };

export function apiFetchBlob(path: string, options: ApiRequestOptions = {}): Promise<DownloadedFile> {
  // The payload is binary, but errors still come back as JSON.
  return request(path, { accept: "*/*", ...options }, async (response) => ({
    blob: await response.blob(),
    filename: parseContentDispositionFilename(response.headers.get("Content-Disposition")),
  }));
}

export function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  let name: string | null = null;

  const extended = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
  if (extended?.[1]) {
    try {
      name = decodeURIComponent(extended[1].trim());
    } catch {
      name = null;
    }
  }
  if (!name) {
    const plain = /filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]+))/.exec(header);
    name = plain?.[1]?.replace(/\\(.)/g, "$1") ?? plain?.[2]?.trim() ?? null;
  }
  if (!name) return null;

  // Never let a header pick a path or smuggle control characters into the save dialog.
  const safe = name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").trim();
  return safe.length > 0 ? safe.slice(0, 200) : null;
}
