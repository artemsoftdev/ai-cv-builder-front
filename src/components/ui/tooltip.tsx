"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

import {
  floatingInnerClasses,
  floatingMotion,
  floatingOuterClasses,
  type FloatingAlign,
  type FloatingSide,
} from "./floating";
import { useKeepInViewport } from "./use-keep-in-viewport";

const SHOW_DELAY_MS = 350;

type TooltipProps = {
  /** Visual only: the trigger must carry the same text as its accessible name. */
  content: string;
  children: ReactNode;
  side?: FloatingSide;
  align?: FloatingAlign;
  className?: string;
};

// Hover/focus hint for icon buttons. Touch has no hover: use Popover for what phone users must read.
export function Tooltip({ content, children, side = "top", align = "center", className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  useKeepInViewport(outerRef, innerRef, open);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  const show = (delay: number) => {
    clearTimer();
    timerRef.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clearTimer();
    setOpen(false);
  };

  useEffect(() => clearTimer, []);

  const onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType === "mouse") show(SHOW_DELAY_MS);
  };
  const onFocus = (event: FocusEvent) => {
    // Only keyboard focus: a mouse click or a tap also focuses the button.
    if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) show(0);
  };

  return (
    <span
      className={cn("relative inline-flex", className)}
      onPointerEnter={onPointerEnter}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={onFocus}
      onBlur={hide}
      onKeyDown={(event) => {
        if (event.key === "Escape") hide();
      }}
    >
      {children}
      <AnimatePresence>
        {open && (
          <span
            key="tooltip"
            ref={outerRef}
            aria-hidden="true"
            className={cn(floatingOuterClasses(side, align), "pointer-events-none")}
          >
            <motion.span
              ref={innerRef}
              {...floatingMotion(side)}
              className={cn(
                floatingInnerClasses(side, align),
                "block w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-md bg-fg px-2.5 py-1.5 text-xs font-medium text-surface shadow-elevated",
              )}
            >
              {content}
            </motion.span>
          </span>
        )}
      </AnimatePresence>
    </span>
  );
}
