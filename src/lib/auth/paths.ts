/**
 * Route constants and redirect-target sanitising. Pure (no browser APIs), so it is shared by
 * the proxy (server) and client components.
 */

/** Name of the HttpOnly session cookie set by the API (docs/API.md, "Authentication"). */
export const SESSION_COOKIE = "cvb_session";

export const HOME_PATH = "/cvs";
export const NEW_CV_PATH = "/cvs/new";
export const LOGIN_PATH = "/login";
export const SIGNUP_PATH = "/signup";
export const AUTH_PAGES: readonly string[] = [LOGIN_PATH, SIGNUP_PATH];

/** Route prefixes that require a session; keep in sync with the matcher in `src/proxy.ts`. */
export const PROTECTED_PREFIXES: readonly string[] = ["/cvs"];

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.includes(pathname);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Validates a `?next=` redirect target. Only same-origin absolute paths are allowed, which
 * rules out open redirects such as `//evil.com`, `/\evil.com` or `https://evil.com`.
 */
export function safeNextPath(raw: string | null | undefined, fallback = HOME_PATH): string {
  if (!raw || raw.length > 2_000) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  // Control characters / whitespace could be normalised by the browser into something else.
  if (/[\u0000-\u001f\u007f\s]/.test(raw)) return fallback;

  let url: URL;
  try {
    url = new URL(raw, "http://localhost");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://localhost") return fallback;
  // Sending a signed-in user back to the login form would be a loop.
  if (isAuthPage(url.pathname)) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** `/login?next=<path>` (or `/signup?...`), dropping `next` when it is not a safe target. */
export function authPageHref(page: typeof LOGIN_PATH | typeof SIGNUP_PATH, next?: string | null): string {
  const target = safeNextPath(next, "");
  return target && target !== HOME_PATH ? `${page}?next=${encodeURIComponent(target)}` : page;
}
