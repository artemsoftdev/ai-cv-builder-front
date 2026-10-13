"use client";

import { createContext, use, useMemo, type ReactNode } from "react";

import type { CvReview, ReviewFlag } from "@/lib/api/types";

type ReviewContextValue = {
  flagsFor: (itemId: string) => readonly ReviewFlag[];
  evidenceFor: (itemId: string) => readonly string[];
  dismiss: (flagIds: string[]) => void;
  openFlagCount: number;
  hasEvidence: boolean;
  disabled: boolean;
};

const EMPTY: readonly never[] = [];

const ReviewContext = createContext<ReviewContextValue>({
  flagsFor: () => [],
  evidenceFor: () => [],
  dismiss: () => undefined,
  openFlagCount: 0,
  hasEvidence: false,
  disabled: true,
});

type ReviewProviderProps = {
  review: CvReview | null;
  dismissed: ReadonlySet<string>;
  onDismiss: (flagIds: string[]) => void;
  disabled: boolean;
  children: ReactNode;
};

export function ReviewProvider({ review, dismissed, onDismiss, disabled, children }: ReviewProviderProps) {
  const value = useMemo<ReviewContextValue>(() => {
    const flagsByItem = new Map<string, ReviewFlag[]>();
    for (const flag of review?.flags ?? []) {
      if (dismissed.has(flag.id)) continue;
      flagsByItem.set(flag.itemId, [...(flagsByItem.get(flag.itemId) ?? []), flag]);
    }
    const evidence = review?.evidence ?? {};
    return {
      flagsFor: (itemId) => flagsByItem.get(itemId) ?? EMPTY,
      evidenceFor: (itemId) => (Object.hasOwn(evidence, itemId) ? (evidence[itemId] ?? EMPTY) : EMPTY),
      dismiss: onDismiss,
      openFlagCount: [...flagsByItem.values()].reduce((total, flags) => total + flags.length, 0),
      hasEvidence: Object.values(evidence).some((quotes) => quotes.length > 0),
      disabled,
    };
  }, [review, dismissed, onDismiss, disabled]);

  return <ReviewContext value={value}>{children}</ReviewContext>;
}

export function useReview(): ReviewContextValue {
  return use(ReviewContext);
}
