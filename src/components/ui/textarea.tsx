import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

import { controlClassName } from "./input";

export type TextareaProps = ComponentProps<"textarea"> & {
  invalid?: boolean;
};

export function Textarea({ invalid, className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      // `field-sizing: content` grows the box with its text where supported; `rows` is the minimum.
      className={cn(controlClassName, "min-h-24 resize-y py-2.5 leading-relaxed [field-sizing:content]", className)}
      {...props}
    />
  );
}
