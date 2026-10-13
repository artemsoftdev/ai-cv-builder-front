import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

export const controlClassName =
  "w-full rounded-lg border border-border bg-surface px-3.5 text-fg shadow-card placeholder:text-fg-subtle " +
  "transition-[border-color,box-shadow] duration-150 hover:border-border-strong " +
  "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 " +
  "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/25 " +
  // 16px on phones stops iOS Safari from zooming into the focused field.
  "text-base sm:text-sm";

export type InputProps = ComponentProps<"input"> & {
  invalid?: boolean;
};

export function Input({ invalid, className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(controlClassName, "h-11", className)}
      {...props}
    />
  );
}
