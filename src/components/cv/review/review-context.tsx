"use client";

import { createContext, use, useMemo, useState, type ReactNode } from "react";

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
  onDismiss: (flagIds: string[]) => void;
  disabled: boolean;
  children: ReactNode;
};

/**
 * Grounding-verifier output (flags + evidence) indexed by item id for the editor. Dismissed
 * flags disappear immediately; the server drops them with the next PATCH response.
 */
export function ReviewProvider({ review, onDismiss, disabled, children }: ReviewProviderProps) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());

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
      dismiss: (flagIds) => {
        setDismissed((current) => new Set([...current, ...flagIds]));
        onDismiss(flagIds);
      },
      openFlagCount: [...flagsByItem.values()].reduce((total, flags) => total + flags.length, 0),
      disabled,
    };
  }, [review, dismissed, onDismiss, disabled]);

  return <ReviewContext value={value}>{children}</ReviewContext>;
}

export function useReview(): ReviewContextValue {
  return use(ReviewContext);
}
