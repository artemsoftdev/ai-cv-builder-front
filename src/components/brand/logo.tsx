import { FileText } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight text-fg", className)}>
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-fg shadow-card"
      >
        <FileText className="size-4.5" strokeWidth={2.25} />
      </span>
      <span className="text-[15px]">CV Builder</span>
    </span>
  );
}
