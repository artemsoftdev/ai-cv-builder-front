"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { cn } from "@/lib/utils/cn";

import {
  floatingInnerClasses,
  floatingMotion,
  floatingOuterClasses,
  type FloatingAlign,
  type FloatingSide,
} from "./floating";
import { useKeepInViewport } from "./use-keep-in-viewport";

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerId: string;
  contentId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext(component: string): PopoverContextValue {
  const ctx = use(PopoverContext);
  if (!ctx) throw new Error(`<${component}> must be used inside <Popover>`);
  return ctx;
}

type PopoverProps = {
  children: ReactNode;
  /** Controlled mode (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

/**
 * Click/tap-to-toggle bubble anchored to its trigger (a "toggletip"). Works the same with a
 * mouse, a finger and a keyboard: Escape closes and returns focus to the trigger, clicking
 * outside or tabbing away closes. Not a modal; content may contain links or buttons.
 *
 * Rendered inline (no portal): avoid `overflow-hidden` ancestors that would clip it.
 *
 * @example
 * <Popover>
 *   <PopoverTrigger aria-label="Why was this flagged?"><Info /></PopoverTrigger>
 *   <PopoverContent>"40%" does not appear in your source.</PopoverContent>
 * </Popover>
 */
export function Popover({ children, open: controlledOpen, onOpenChange, className }: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerId = useId();
  const contentId = useId();

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const closeOnOutsidePointer = useEffectEvent((event: PointerEvent) => {
    if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => closeOnOutsidePointer(event);
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  const handleBlur = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (open && next instanceof Node && !rootRef.current?.contains(next)) setOpen(false);
  };

  return (
    <PopoverContext value={{ open, setOpen, triggerId, contentId, triggerRef }}>
      <span
        ref={rootRef}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={cn("relative inline-flex", className)}
      >
        {children}
      </span>
    </PopoverContext>
  );
}

export function PopoverTrigger({ className, onClick, ...props }: Omit<ComponentProps<"button">, "ref">) {
  const { open, setOpen, triggerId, contentId, triggerRef } = usePopoverContext("PopoverTrigger");
  return (
    <button
      ref={triggerRef}
      type="button"
      id={triggerId}
      aria-expanded={open}
      aria-controls={open ? contentId : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
      className={cn(
        "inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}

type PopoverContentProps = {
  children: ReactNode;
  side?: FloatingSide;
  align?: FloatingAlign;
  className?: string;
};

/**
 * Rendered as `<span>`s so a Popover can sit inside text (e.g. next to a bullet in a `<p>`);
 * keep its content to phrasing content: text, links, buttons.
 */
export function PopoverContent({ children, side = "bottom", align = "center", className }: PopoverContentProps) {
  const { open, triggerId, contentId } = usePopoverContext("PopoverContent");
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  useKeepInViewport(outerRef, innerRef, open);

  return (
    <AnimatePresence>
      {open && (
        <span key="popover" ref={outerRef} className={floatingOuterClasses(side, align)}>
          <motion.span
            ref={innerRef}
            id={contentId}
            role="dialog"
            aria-labelledby={triggerId}
            {...floatingMotion(side)}
            className={cn(
              floatingInnerClasses(side, align),
              "block w-max max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-3.5 text-left text-sm font-normal leading-relaxed text-fg shadow-elevated",
              className,
            )}
          >
            {children}
          </motion.span>
        </span>
      )}
    </AnimatePresence>
  );
}
