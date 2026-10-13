import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-md bg-surface-muted motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}
