"use client";

import { useLayoutEffect, type RefObject } from "react";

const VIEWPORT_MARGIN_PX = 8;

/**
 * Nudges a floating element horizontally so it never sticks out of the viewport (which on a
 * 360px phone would cause horizontal scrolling). Measures `measureRef` (the visible bubble)
 * and shifts `shiftRef` (its positioned wrapper) with the CSS `translate` property.
 */
export function useKeepInViewport(
  shiftRef: RefObject<HTMLElement | null>,
  measureRef: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useLayoutEffect(() => {
    const target = shiftRef.current;
    const bubble = measureRef.current;
    if (!active || !target || !bubble) return;

    target.style.translate = "";
    const rect = bubble.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    let shift = 0;
    if (rect.left < VIEWPORT_MARGIN_PX) {
      shift = VIEWPORT_MARGIN_PX - rect.left;
    } else if (rect.right > viewportWidth - VIEWPORT_MARGIN_PX) {
      shift = viewportWidth - VIEWPORT_MARGIN_PX - rect.right;
    }
    if (shift !== 0) target.style.translate = `${Math.round(shift)}px 0`;
  }, [shiftRef, measureRef, active]);
}
