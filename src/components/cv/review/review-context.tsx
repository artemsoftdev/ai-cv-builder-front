"use client";

import { createContext, use, useMemo, type ReactNode } from "react";

import type { CvReview, ReviewFlag } from "@/lib/api/types";

type ReviewContextValue = {
  /** Unresolved verifier flags for an item (`Bullet.id`, `ExperienceItem.id`, 'summary', ...). */
  flagsFor: (itemId: string) => readonly ReviewFlag[];
  /** Verified quotes from the source supporting an item. */
  evidenceFor: (itemId: string) => readonly string[];
  /** Hides the flags right away and saves the dismissal. */
  dismiss: (flagIds: string[]) => void;
  /** Number of flags still shown. */
  openFlagCount: number;
  /** Dismissing is not possible while a background job owns the CV. */
  disabled: boolean;
};

const EMPTY: readonly never[] = [];

const ReviewContext = createContext<ReviewContextValue>({
  flagsFor: () => [],
  evidenceFor: () => [],
  dismiss: () => undefined,
  openFlagCount: 0,
  disabled: true,
});

type ReviewProviderProps = {
  review: CvReview | null;
  /** Flags dismissed in this session, hidden before the server confirms it. */
  dismissed: ReadonlySet<string>;
  onDismiss: (flagIds: string[]) => void;
  disabled: boolean;
  children: ReactNode;
};

/** Grounding-verifier output (flags + evidence) indexed by item id for the editor. */
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
      disabled,
    };
  }, [review, dismissed, onDismiss, disabled]);

  return <ReviewContext value={value}>{children}</ReviewContext>;
}

export function useReview(): ReviewContextValue {
  return use(ReviewContext);
}
