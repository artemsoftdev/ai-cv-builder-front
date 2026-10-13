"use client";

import { useEffect, useRef, type RefObject } from "react";

// Only `enabled` at mount counts: later re-renders must not steal focus.
export function useFocusOnMount(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  const enabledOnMount = useRef(enabled);
  useEffect(() => {
    if (enabledOnMount.current) ref.current?.focus();
  }, [ref]);
}
