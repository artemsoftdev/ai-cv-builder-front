"use client";

import { Check, CloudOff, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { SaveState } from "@/lib/cv/save-queue";
import { cn } from "@/lib/utils/cn";

type SaveStatusProps = {
  state: SaveState;
  invalid: boolean;
  onRetry: () => void;
  className?: string;
};

type Display = { icon: ReactNode; text: string; tone: "muted" | "warning" | "danger"; retry?: boolean };

function describe(state: SaveState, invalid: boolean): Display {
  switch (state.status) {
    case "conflict":
      return { icon: <Spinner size="sm" />, text: "Loading the latest version…", tone: "muted", retry: true };
    case "waiting":
      return { icon: <Spinner size="sm" />, text: "Waiting for the update to finish…", tone: "muted" };
    case "error":
      return {
        icon: <CloudOff className="size-4" />,
        text: state.willRetry ? "Couldn't save — retrying…" : "Couldn't save",
        tone: "danger",
        retry: true,
      };
  }
  if (invalid) return { icon: <TriangleAlert className="size-4" />, text: "Fix the highlighted fields to save", tone: "warning" };
  if (state.status === "saved") return { icon: <Check className="size-4" />, text: "All changes saved", tone: "muted" };
  return { icon: <Spinner size="sm" />, text: "Saving…", tone: "muted" };
}

export function SaveStatus({ state, invalid, onRetry, className }: SaveStatusProps) {
  const { icon, text, tone, retry } = describe(state, invalid);
  return (
    <div
      role="status"
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
      <span className="min-w-0 truncate">{text}</span>
      {retry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="-my-1 px-2.5 text-current">
          {state.status === "conflict" ? "Reload" : "Retry"}
        </Button>
      )}
    </div>
  );
}
