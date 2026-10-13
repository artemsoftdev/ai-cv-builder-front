"use client";

import { useNow } from "@/lib/hooks/use-now";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/format";

export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const now = useNow();
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={className} suppressHydrationWarning>
      {formatRelativeTime(iso, now)}
    </time>
  );
}
