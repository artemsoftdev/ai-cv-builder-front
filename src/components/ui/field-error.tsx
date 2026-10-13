import { CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils/cn";

type FieldErrorProps = {
  id?: string;
  message?: string;
  className?: string;
};

export function FieldError({ id, message, className }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p id={id} className={cn("flex items-start gap-1.5 text-sm text-danger-soft-fg", className)}>
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
