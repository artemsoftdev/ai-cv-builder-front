import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

export type LabelProps = ComponentProps<"label"> & {
  /** Appends a muted "(optional)" marker. */
  optional?: boolean;
};

export function Label({ optional, className, children, ...props }: LabelProps) {
  return (
    <label className={cn("block text-sm font-medium text-fg", className)} {...props}>
      {children}
      {optional && <span className="ml-1 font-normal text-fg-subtle">(optional)</span>}
    </label>
  );
}
