"use client";

import { useNow } from "@/lib/hooks/use-now";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/format";

/** `<time>` showing "3 hours ago" (kept fresh) with the exact date as a tooltip. */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const now = useNow();
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={className} suppressHydrationWarning>
      {formatRelativeTime(iso, now)}
    </time>
  );
}
