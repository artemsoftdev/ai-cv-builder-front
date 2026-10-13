import { Badge } from "@/components/ui/badge";
import type { CvSummary } from "@/lib/api/types";

import { getCvStatusDisplay } from "./cv-status";

export function CvStatusBadge({
  cv,
  className,
}: {
  cv: Pick<CvSummary, "status" | "stage" | "busy">;
  className?: string;
}) {
  const { label, tone, pulse } = getCvStatusDisplay(cv);
  return (
    <Badge tone={tone} dot pulse={pulse} className={className}>
      {label}
    </Badge>
  );
}
