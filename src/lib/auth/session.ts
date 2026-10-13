import { CSRF_HEADER } from "@/lib/api/client";

import { authPageHref, isAuthPage, LOGIN_PATH } from "./paths";

const SESSION_CLEAR_PATH = "/auth/session";

let leaving = false;

if (typeof window !== "undefined") {
  // Back from the back-forward cache after leaving: the page is alive again and must handle 401s.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) leaving = false;
  });
}

// Indirection so tests can observe full-page navigations (jsdom does not navigate).
export const browserNavigation = {
  replace: (url: string) => window.location.replace(url),
};

export function isLeaving(): boolean {
  return leaving;
}

// Also stops handleSessionExpired from racing late 401s while we leave.
export function leaveTo(url: string): void {
  leaving = true;
  browserNavigation.replace(url);
}

// The proxy only checks that a cookie exists, so a stale one would bounce /login -> /cvs -> 401 forever.
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

// beforeRedirect runs last: clearing the cache earlier would make mounted queries refetch and 401 again.
export async function handleSessionExpired(beforeRedirect?: () => void): Promise<void> {
  if (leaving || typeof window === "undefined") return;
  const { pathname, search } = window.location;
  if (isAuthPage(pathname)) return;
  leaving = true;
  await clearSessionCookie();
  beforeRedirect?.();
  browserNavigation.replace(authPageHref(LOGIN_PATH, `${pathname}${search}`));
}
