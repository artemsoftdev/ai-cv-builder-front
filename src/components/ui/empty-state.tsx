import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Usually a primary Button or button-styled Link. */
  action?: ReactNode;
  /** "danger" is used for error states (failed to load, ...). */
  tone?: "neutral" | "danger";
  className?: string;
};

export function EmptyState({ icon, title, description, action, tone = "neutral", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-border-strong bg-surface/60 px-6 py-12 text-center sm:py-16",
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden="true"
          className={cn(
            "mb-4 flex size-12 items-center justify-center rounded-xl [&_svg]:size-6",
            tone === "danger" ? "bg-danger-soft text-danger-soft-fg" : "bg-primary-soft text-primary-soft-fg",
          )}
        >
          {icon}
        </div>
      )}
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      {description && <div className="mt-1.5 max-w-sm text-sm text-fg-muted">{description}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
