"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { isApiError } from "@/lib/api/errors";
import type { CvStatus } from "@/lib/api/types";
import { hasContent } from "@/lib/cv/ready-cv";
import { useCv } from "@/lib/query/cv-hooks";

import { CvLoadError, CvNotFound, CvSkeleton } from "./cv-states";
import { GenerationFailed } from "./generation/generation-failed";
import { GenerationProgress } from "./generation/generation-progress";
import { CvWorkspace } from "./workspace/cv-workspace";

export function CvView({ cvId }: { cvId: string }) {
  const query = useCv(cvId);
  const cv = query.data;
  const status = cv?.status;

  const [shownStatus, setShownStatus] = useState<CvStatus | undefined>(status);
  const [statusChanged, setStatusChanged] = useState(false);
  if (status !== shownStatus) {
    setShownStatus(status);
    setStatusChanged(shownStatus !== undefined);
  }
  const [retryStartedAt, setRetryStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (statusChanged && status === "ready") {
      toast.success("Your CV is ready", { description: "Review the highlighted details and answer Claude's questions." });
    }
  }, [statusChanged, status]);

  const title = cv?.title;
  useEffect(() => {
    if (title) document.title = `${title} · CV Builder`;
  }, [title]);

  // 400 = malformed id in the URL; 404 = deleted or someone else's CV.
  if (isApiError(query.error, "NOT_FOUND") || isApiError(query.error, "VALIDATION_ERROR")) {
    return <CvNotFound />;
  }
  if (!cv) {
    return query.isError ? (
      <CvLoadError error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
    ) : (
      <CvSkeleton />
    );
  }

  if (cv.status === "generating") {
    return (
      <GenerationProgress
        cv={cv}
        connectionLost={query.isRefetchError}
        startedAt={retryStartedAt}
        autoFocus={statusChanged}
      />
    );
  }
  if (cv.status === "failed" || !hasContent(cv)) {
    return <GenerationFailed cv={cv} onRetried={() => setRetryStartedAt(Date.now())} autoFocus={statusChanged} />;
  }
  return (
    <CvWorkspace
      cv={cv}
      refetch={query.refetch}
      refetchFailed={query.isRefetchError}
      autoFocus={statusChanged}
    />
  );
}
