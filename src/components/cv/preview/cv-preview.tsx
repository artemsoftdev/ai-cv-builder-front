"use client";

import { useDeferredValue, useRef } from "react";
import { useWatch } from "react-hook-form";

import type { CvContent } from "@/lib/api/types";
import { useElementSize } from "@/lib/hooks/use-element-size";
import { cn } from "@/lib/utils/cn";

import { CvDocument } from "./cv-document";

/** A4 at 96 dpi (210 x 297 mm). */
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;

/**
 * Live preview of the editor's current values (including unsaved edits), drawn at real A4
 * size and scaled down to the available width. Page breaks are marked, approximately.
 * Hidden from assistive tech: it repeats the editor's content, and the PDF is the output.
 */
export function CvPreview({ className }: { className?: string }) {
  const values = useWatch<CvContent>() as CvContent;
  // Typing stays responsive: the preview catches up when React has time.
  const content = useDeferredValue(values);
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(frameRef);
  const { height } = useElementSize(sheetRef);

  const scale = width > 0 ? width / PAGE_WIDTH : 0;
  const pages = Math.max(1, Math.ceil(height / PAGE_HEIGHT));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h2 className="text-sm font-semibold text-fg">Preview</h2>
        <p className="text-xs text-fg-subtle">
          A4 · {pages} {pages === 1 ? "page" : "pages"}
        </p>
      </div>
      <div
        ref={frameRef}
        aria-hidden="true"
        className="relative overflow-hidden rounded-lg bg-white shadow-elevated ring-1 ring-border"
        style={{ height: pages * PAGE_HEIGHT * scale || undefined, aspectRatio: scale ? undefined : "210 / 297" }}
      >
        <div
          ref={sheetRef}
          className="absolute top-0 left-0 origin-top-left bg-white"
          style={{ width: PAGE_WIDTH, minHeight: PAGE_HEIGHT, transform: `scale(${scale})` }}
        >
          <CvDocument content={content} />
          {Array.from({ length: pages - 1 }, (_, index) => (
            <div
              key={index}
              className="absolute inset-x-0 border-t-2 border-dashed border-border-strong"
              style={{ top: (index + 1) * PAGE_HEIGHT }}
            >
              <span className="absolute -top-3.5 right-4 bg-white px-2 text-xs text-fg-subtle">Page {index + 2}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="px-0.5 text-xs text-fg-subtle">The downloaded PDF has the same layout, with selectable text.</p>
    </div>
  );
}
