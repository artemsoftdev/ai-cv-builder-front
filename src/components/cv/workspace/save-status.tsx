"use client";

import { Check, CloudOff, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getErrorMessage } from "@/lib/api/error-messages";
import { getValidationIssues, isApiError, isTransientError } from "@/lib/api/errors";
import type { SaveState } from "@/lib/cv/save-queue";
import { cn } from "@/lib/utils/cn";

type SaveStatusProps = {
  state: SaveState;
  invalid: boolean;
  onRetry: () => void;
  onShowInvalid?: () => void;
  className?: string;
};

type Display = {
  icon: ReactNode;
  text: string;
  tone: "muted" | "warning" | "danger";
  action?: "Retry" | "Reload" | "Show";
};

// A rejected save (4xx) fails the same way again: say why instead of offering a blind retry.
function rejectionReason(error: unknown): string {
  const issue = isApiError(error, "VALIDATION_ERROR") ? getValidationIssues(error)[0] : undefined;
  return issue?.message ?? getErrorMessage(error);
}

function describe(state: SaveState, invalid: boolean): Display {
  switch (state.status) {
    case "conflict":
      return { icon: <Spinner size="sm" />, text: "Loading the latest version…", tone: "muted", action: "Reload" };
    case "waiting":
      return { icon: <Spinner size="sm" />, text: "Waiting for the update to finish…", tone: "muted" };
    case "error":
      if (!state.willRetry && !isTransientError(state.error)) {
        return {
          icon: <CloudOff className="size-4" />,
          text: `Couldn't save: ${rejectionReason(state.error)}`,
          tone: "danger",
        };
      }
      return {
        icon: <CloudOff className="size-4" />,
        text: state.willRetry ? "Couldn't save — retrying…" : "Couldn't save",
        tone: "danger",
        action: "Retry",
      };
  }
  if (invalid) {
    return {
      icon: <TriangleAlert className="size-4" />,
      text: "Fix the highlighted fields to save",
      tone: "warning",
      action: "Show",
    };
  }
  if (state.status === "saved") return { icon: <Check className="size-4" />, text: "All changes saved", tone: "muted" };
  return { icon: <Spinner size="sm" />, text: "Saving…", tone: "muted" };
}

export function SaveStatus({ state, invalid, onRetry, onShowInvalid, className }: SaveStatusProps) {
  const { icon, text, tone, action } = describe(state, invalid);
  // Only problems are announced: "Saving…" / "All changes saved" after every pause would drown everything else.
  const announcement = tone === "muted" && state.status !== "waiting" ? "" : text;
  return (
    <div
      className={cn(
        "flex min-h-10 min-w-0 items-center gap-2 text-sm",
        tone === "muted" && "text-fg-muted",
        tone === "warning" && "text-warning-soft-fg",
        tone === "danger" && "text-danger-soft-fg",
        className,
      )}
    >
      <span aria-hidden="true" className="flex shrink-0">
        {icon}
      </span>
      <span className="min-w-0 truncate" title={text}>
        {text}
      </span>
      <span role="status" className="sr-only">
        {announcement}
      </span>
      {action && (action !== "Show" || onShowInvalid) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={action === "Show" ? onShowInvalid : onRetry}
          aria-label={action === "Show" ? "Show the first field to fix" : undefined}
          className="-my-1 px-2.5 text-current"
        >
          {action}
        </Button>
      )}
    </div>
  );
}
