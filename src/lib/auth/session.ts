import { CSRF_HEADER } from "@/lib/api/client";

import { authPageHref, isAuthPage, LOGIN_PATH } from "./paths";

/** Next.js route handler that expires the HttpOnly session cookie (see app/auth/session/route.ts). */
export const SESSION_CLEAR_PATH = "/auth/session";

let leaving = false;

/**
 * Full page navigation (drops all in-memory state). Also tells `handleSessionExpired` that
 * we are already on our way out, so late 401s from in-flight requests don't race it.
 */
export function leaveTo(url: string): void {
  leaving = true;
  window.location.replace(url);
}

/**
 * Asks the Next server to expire the session cookie. Needed when the API rejects a cookie
 * (expired, DB reset): the proxy only checks that the cookie *exists*, so a stale one would
 * bounce /login -> /cvs -> 401 -> /login forever. Best effort.
 */
export async function clearSessionCookie(): Promise<void> {
  try {
    await fetch(SESSION_CLEAR_PATH, {
      method: "DELETE",
      headers: { [CSRF_HEADER.name]: CSRF_HEADER.value },
      credentials: "same-origin",
    });
  } catch {
    // Offline: the redirect below fails anyway and the user can retry.
  }
}

/**
 * Global reaction to `401 UNAUTHORIZED`: forget the session and go to /login?next=<here>.
 * `beforeRedirect` runs right before navigating (used to clear the query cache; doing it
 * earlier would make mounted queries refetch and 401 again while we wait).
 */
export async function handleSessionExpired(beforeRedirect?: () => void): Promise<void> {
  if (leaving || typeof window === "undefined") return;
  const { pathname, search } = window.location;
  if (isAuthPage(pathname)) return;
  leaving = true;
  await clearSessionCookie();
  beforeRedirect?.();
  window.location.replace(authPageHref(LOGIN_PATH, `${pathname}${search}`));
}
