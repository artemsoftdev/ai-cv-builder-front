"use client";

import { useEffect, type RefObject } from "react";

/**
 * Focuses an element (usually a heading with `tabIndex={-1}`) when it mounts, so that
 * keyboard and screen reader users land on content that replaced what they were looking at.
 */
export function useFocusOnMount(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    if (enabled) ref.current?.focus({ preventScroll: false });
    // Only on mount: later re-renders must not steal focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
