"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, kept in sync with the viewport. On the server (and during
 * hydration) it reports `false`, so use it for layout decisions of client-rendered UI.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind's `lg` breakpoint (64rem): two-column workspace from here on. */
export const DESKTOP_QUERY = "(min-width: 64rem)";
