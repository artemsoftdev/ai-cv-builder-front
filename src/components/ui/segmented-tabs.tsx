"use client";

import { motion } from "motion/react";
import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type SegmentedTabOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  /** Small trailing element, e.g. a count. */
  badge?: ReactNode;
};

type SegmentedTabsProps<T extends string> = {
  /** Accessible name of the tab list. */
  label: string;
  /** Prefix for the tab / panel ids, see `tabId` and `panelId`. */
  idPrefix: string;
  options: readonly SegmentedTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export const tabId = (idPrefix: string, value: string) => `${idPrefix}-tab-${value}`;
export const panelId = (idPrefix: string, value: string) => `${idPrefix}-panel-${value}`;

/**
 * Segmented control with tab semantics (WAI-ARIA tabs, automatic activation): arrow keys,
 * Home and End move between options. The selected pill slides between options (motion
 * `layoutId`). Render the panels with `role="tabpanel"`, `id={panelId(...)}` and
 * `aria-labelledby={tabId(...)}`.
 */
export function SegmentedTabs<T extends string>({
  label,
  idPrefix,
  options,
  value,
  onChange,
  className,
}: SegmentedTabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const select = (index: number) => {
    const option = options[(index + options.length) % options.length];
    if (!option) return;
    onChange(option.value);
    listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(tabId(idPrefix, option.value))}`)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: options.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={cn("flex gap-1 rounded-xl bg-surface-muted p-1 ring-1 ring-border ring-inset", className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={tabId(idPrefix, option.value)}
            aria-selected={selected}
            aria-controls={panelId(idPrefix, option.value)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "relative flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
              selected ? "text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {selected && (
              <motion.span
                layoutId={`${idPrefix}-pill`}
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-surface shadow-card ring-1 ring-border"
                transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              />
            )}
            <span className="relative flex min-w-0 items-center gap-2">
              {option.icon}
              <span className="truncate">{option.label}</span>
              {option.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}
