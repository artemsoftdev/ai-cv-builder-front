"use client";

import { MessageCircleQuestion, Target, Trash2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import { Tooltip } from "@/components/ui/tooltip";
import type { CvSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";

import { CvStatusBadge } from "./cv-status-badge";

type CvCardProps = {
  cv: CvSummary;
  onDelete: (cv: CvSummary) => void;
  className?: string;
};

/**
 * The whole card is a link to the CV (stretched `::after` over the card), while the delete
 * button sits above it, so there is no interactive element nested inside the link.
 */
export function CvCard({ cv, onDelete, className }: CvCardProps) {
  const title = cv.title.trim() || "Untitled CV";

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-card",
        "transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elevated",
        "has-[a:focus-visible]:ring-4 has-[a:focus-visible]:ring-ring",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <CvStatusBadge cv={cv} />
        <Tooltip content="Delete CV" align="end" className="relative z-10 -mr-2 -mt-2">
          <Button
            variant="danger-ghost"
            size="icon-sm"
            aria-label={`Delete CV “${title}”`}
            onClick={() => onDelete(cv)}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </Button>
        </Tooltip>
      </div>

      <h2 className="mt-3 line-clamp-2 text-base font-semibold leading-snug break-words text-fg">
        <Link
          href={`/cvs/${encodeURIComponent(cv.id)}`}
          className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
        >
          {title}
        </Link>
      </h2>

      <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm text-fg-muted">
        <Target aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
        <span className="truncate">{cv.targetRole}</span>
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-5 text-xs text-fg-subtle">
        {cv.openQuestions > 0 && (
          <Badge tone="warning">
            <MessageCircleQuestion aria-hidden="true" className="size-3.5" />
            {cv.openQuestions === 1 ? "1 open question" : `${cv.openQuestions} open questions`}
          </Badge>
        )}
        <span className="ml-auto">
          Updated <RelativeTime iso={cv.updatedAt} />
        </span>
      </div>
    </article>
  );
}
