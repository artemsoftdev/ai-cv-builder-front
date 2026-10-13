"use client";

import { FilePlus2, RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { describeGenerationLimit, describeJobError, getErrorMessage, isRetryableJobError } from "@/lib/api/error-messages";
import { isApiError } from "@/lib/api/errors";
import type { Cv } from "@/lib/api/types";
import { HOME_PATH, NEW_CV_PATH } from "@/lib/auth/paths";
import { useFocusOnMount } from "@/lib/hooks/use-focus-on-mount";
import { useRetryCv } from "@/lib/query/cv-hooks";

import { CvPageShell } from "../cv-page-shell";

type GenerationFailedProps = {
  cv: Cv;
  onRetried?: () => void;
  autoFocus?: boolean;
};

export function GenerationFailed({ cv, onRetried, autoFocus = false }: GenerationFailedProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useFocusOnMount(headingRef, autoFocus);
  const retry = useRetryCv(cv.id);

  // The API writes this message for users and it is more specific than the code (e.g. a rejected key).
  const explanation = cv.error?.message.trim() || describeJobError(cv.error?.code);
  // An unreadable source fails the same way again: offer a fresh start instead.
  const retryable = isRetryableJobError(cv.error?.code);

  const handleRetry = () => {
    retry.mutate(undefined, {
      onSuccess: () => onRetried?.(),
      onError: (error) =>
        toast.error("Couldn't restart the generation", {
          description: isApiError(error, "RATE_LIMITED") ? describeGenerationLimit(error) : getErrorMessage(error),
        }),
    });
  };

  return (
    <CvPageShell>
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card sm:p-8">
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-xl bg-danger-soft text-danger-soft-fg"
        >
          <TriangleAlert className="size-5" />
        </span>
        <h1 ref={headingRef} tabIndex={-1} className="mt-4 text-xl font-semibold tracking-tight outline-none sm:text-2xl">
          We couldn&apos;t create this CV
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{explanation}</p>
        <p className="mt-3 text-sm break-words text-fg-muted">
          Target role: <span className="font-medium text-fg">{cv.targetRole}</span>
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
          <Link href={HOME_PATH} className={buttonVariants({ variant: "secondary" })}>
            Back to your CVs
          </Link>
          {retryable ? (
            <Button
              onClick={handleRetry}
              loading={retry.isPending || retry.isSuccess}
              leftIcon={<RotateCcw aria-hidden="true" className="size-4" />}
            >
              Try again
            </Button>
          ) : (
            <Link href={NEW_CV_PATH} className={buttonVariants()}>
              <FilePlus2 aria-hidden="true" className="size-4" />
              Start with another source
            </Link>
          )}
        </div>
      </div>
    </CvPageShell>
  );
}
