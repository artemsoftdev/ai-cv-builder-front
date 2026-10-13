import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, { badge: string; dot: string }> = {
  neutral: { badge: "bg-surface-muted text-fg-muted ring-border", dot: "bg-fg-subtle" },
  primary: { badge: "bg-primary-soft text-primary-soft-fg ring-primary/15", dot: "bg-primary" },
  success: { badge: "bg-success-soft text-success-soft-fg ring-success/20", dot: "bg-success" },
  warning: { badge: "bg-warning-soft text-warning-soft-fg ring-warning/25", dot: "bg-warning" },
  danger: { badge: "bg-danger-soft text-danger-soft-fg ring-danger/15", dot: "bg-danger" },
};

type BadgeProps = ComponentProps<"span"> & {
  tone?: BadgeTone;
  dot?: boolean;
  pulse?: boolean;
};

export function Badge({ tone = "neutral", dot = false, pulse = false, className, children, ...props }: BadgeProps) {
  const style = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        style.badge,
        className,
      )}
      {...props}
    >
      {dot && (
        <span aria-hidden="true" className="relative flex size-1.5">
          {pulse && (
            <span className={cn("absolute inline-flex size-full rounded-full opacity-70 motion-safe:animate-ping", style.dot)} />
          )}
          <span className={cn("relative inline-flex size-1.5 rounded-full", style.dot)} />
        </span>
      )}
      {children}
    </span>
  );
}
