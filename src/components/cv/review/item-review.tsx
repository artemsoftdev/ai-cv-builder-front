"use client";

import { Quote, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";

import { useReview } from "./review-context";

type ItemReviewProps = {
  itemId: string;
  label: string;
  className?: string;
};

export function ItemReview({ itemId, label, className }: ItemReviewProps) {
  const { flagsFor, evidenceFor } = useReview();
  const flags = flagsFor(itemId);
  const quotes = evidenceFor(itemId);
  if (flags.length === 0 && quotes.length === 0) return null;

  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      {flags.length > 0 && <FlagBadge itemId={itemId} label={label} />}
      {quotes.length > 0 && <EvidenceButton quotes={quotes} label={label} />}
    </span>
  );
}

function FlagBadge({ itemId, label }: { itemId: string; label: string }) {
  const { flagsFor, dismiss, disabled } = useReview();
  const flags = flagsFor(itemId);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  const handleDismiss = () => {
    // The badge disappears with the flag: move focus to the field it was about.
    const scope = rootRef.current?.closest("[data-review-scope]");
    setOpen(false);
    dismiss(flags.map((flag) => flag.id));
    requestAnimationFrame(() => scope?.querySelector<HTMLElement>("textarea, input")?.focus());
  };

  return (
    <span ref={rootRef} className="inline-flex">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={`Check ${label}: ${flags.length === 1 ? "1 warning" : `${flags.length} warnings`}`}
          className="px-0.5"
        >
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-warning-soft px-2 text-xs font-medium text-warning-soft-fg ring-1 ring-warning/30 ring-inset">
            <TriangleAlert aria-hidden="true" className="size-3.5" />
            Check
          </span>
        </PopoverTrigger>
        <PopoverContent align="end">
          <span className="block font-medium text-fg">Please double-check {label}</span>
          {flags.map((flag) => (
            <span key={flag.id} className="mt-1.5 block break-words text-fg-muted">
              {flag.reason}
            </span>
          ))}
          <span className="mt-2 block text-xs text-fg-subtle">
            Editing the text clears this warning. Dismiss it if the text is correct.
          </span>
          <span className="mt-3 flex justify-end">
            <Button size="sm" variant="secondary" onClick={handleDismiss} disabled={disabled}>
              Dismiss
            </Button>
          </span>
        </PopoverContent>
      </Popover>
    </span>
  );
}

function EvidenceButton({ quotes, label }: { quotes: readonly string[]; label: string }) {
  return (
    <Popover>
      <PopoverTrigger aria-label={`Where ${label} comes from in your source`} className="text-success">
        <Quote aria-hidden="true" className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end">
        <span className="block font-medium text-fg">Found in your source</span>
        {quotes.map((quote, index) => (
          <span key={index} className="mt-2 block border-l-2 border-success/50 pl-2.5 break-words text-fg-muted italic">
            “{quote}”
          </span>
        ))}
      </PopoverContent>
    </Popover>
  );
}
