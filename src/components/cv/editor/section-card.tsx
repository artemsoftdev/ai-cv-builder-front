"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import type { CvSectionKey } from "@/lib/cv/sections";
import { cn } from "@/lib/utils/cn";

import { useEditor } from "./editor-context";

type SectionCardProps = {
  section: CvSectionKey;
  title: string;
  icon: ReactNode;
  count?: number;
  updated?: boolean;
  headerAddon?: ReactNode;
  children: ReactNode;
};

export function SectionCard({ section, title, icon, count, updated = false, headerAddon, children }: SectionCardProps) {
  const [open, setOpen] = useState(true);
  const { readOnly } = useEditor();
  const headingId = useId();
  const bodyId = useId();

  return (
    <section
      id={`cv-section-${section}`}
      aria-labelledby={headingId}
      className={cn(
        "scroll-mt-32 rounded-xl border border-border bg-surface shadow-card",
        updated && "motion-safe:animate-section-updated",
      )}
    >
      <div className="flex items-center gap-1 px-3 py-2 sm:px-4">
        <h2 id={headingId} className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((value) => !value)}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-1 text-left text-base font-semibold text-fg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
          >
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg [&_svg]:size-4"
            >
              {icon}
            </span>
            <span className="truncate">{title}</span>
            {count !== undefined && <span className="text-sm font-normal text-fg-subtle">{count}</span>}
            <AnimatePresence>
              {updated && (
                <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <Badge tone="primary">Updated</Badge>
                </motion.span>
              )}
            </AnimatePresence>
            <ChevronDown
              aria-hidden="true"
              className={cn("ml-auto size-4 shrink-0 text-fg-subtle transition-transform", open && "rotate-180")}
            />
          </button>
        </h2>
        {headerAddon}
      </div>
      <div id={bodyId} hidden={!open} className="border-t border-border px-4 pt-4 pb-5 sm:px-5">
        {/* A fieldset is min-content wide by default and would overflow on phones. */}
        <fieldset disabled={readOnly} className="min-w-0">
          {children}
        </fieldset>
      </div>
    </section>
  );
}
