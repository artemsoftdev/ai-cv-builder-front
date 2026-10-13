"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { describeJobError, getErrorMessage } from "@/lib/api/error-messages";
import type { Cv } from "@/lib/api/types";
import { HOME_PATH } from "@/lib/auth/paths";
import { useFocusOnMount } from "@/lib/hooks/use-focus-on-mount";
import { useRetryCv } from "@/lib/query/cv-hooks";

import { CvPageShell } from "../cv-page-shell";

type GenerationFailedProps = {
  cv: Cv;
  /** Called when the retry was accepted (the CV is generating again). */
  onRetried?: () => void;
  autoFocus?: boolean;
};

export function GenerationFailed({ cv, onRetried, autoFocus = false }: GenerationFailedProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useFocusOnMount(headingRef, autoFocus);
  const retry = useRetryCv(cv.id);

  const explanation = describeJobError(cv.error?.code);
  // The server message adds specifics (e.g. which limit was hit); skip it when it says the same.
  const details = cv.error?.message && cv.error.message !== explanation ? cv.error.message : null;

  const handleRetry = () => {
    retry.mutate(undefined, {
      onSuccess: () => onRetried?.(),
      onError: (error) => toast.error("Couldn't restart the generation", { description: getErrorMessage(error) }),
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
        {details && (
          <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-sm break-words text-fg-muted">
            <span className="font-medium text-fg">Details: </span>
            {details}
          </p>
        )}
        <p className="mt-3 text-sm break-words text-fg-muted">
          Target role: <span className="font-medium text-fg">{cv.targetRole}</span>
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
          <Link href={HOME_PATH} className={buttonVariants({ variant: "secondary" })}>
            Back to your CVs
          </Link>
          <Button
            onClick={handleRetry}
            loading={retry.isPending || retry.isSuccess}
            leftIcon={<RotateCcw aria-hidden="true" className="size-4" />}
          >
            Try again
          </Button>
        </div>
      </div>
    </CvPageShell>
  );
}
