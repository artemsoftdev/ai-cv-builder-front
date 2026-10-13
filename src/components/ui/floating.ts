export type FloatingSide = "top" | "bottom";
export type FloatingAlign = "start" | "center" | "end";

/*
 * Floating bubbles (Popover, Tooltip) are rendered as two boxes inside a `relative` wrapper:
 * - outer: absolutely positioned against the trigger; `useKeepInViewport` nudges it;
 * - inner: the visible bubble; owns the centering translate and the motion animation.
 * Keeping these on separate elements means the three transforms never overwrite each other.
 */

const outerSide: Record<FloatingSide, string> = {
  top: "bottom-full pb-2",
  bottom: "top-full pt-2",
};

const outerAlign: Record<FloatingAlign, string> = {
  start: "left-0",
  center: "left-1/2",
  end: "right-0",
};

export function floatingOuterClasses(side: FloatingSide, align: FloatingAlign): string {
  return `absolute z-50 ${outerSide[side]} ${outerAlign[align]}`;
}

export function floatingInnerClasses(side: FloatingSide, align: FloatingAlign): string {
  const origin = side === "top" ? "origin-bottom" : "origin-top";
  return align === "center" ? `${origin} -translate-x-1/2` : origin;
}

/** Small enter/exit animation for floating bubbles (spread onto a motion element). */
export function floatingMotion(side: FloatingSide) {
  const offset = side === "top" ? 4 : -4;
  return {
    initial: { opacity: 0, y: offset, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: offset, scale: 0.97 },
    transition: { duration: 0.14, ease: "easeOut" },
  } as const;
}
