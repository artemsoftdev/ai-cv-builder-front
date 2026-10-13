import { ApiError } from "@/lib/api/errors";
import type { Cv, CvSummary } from "@/lib/api/types";

/** docs/API.md: poll `GET /api/cvs/:id` every ~1.5 s while work is in progress. */
export const CV_POLL_INTERVAL_MS = 1_500;
/** The list only needs coarse progress (status badges), so it polls less often. */
export const CV_LIST_POLL_INTERVAL_MS = 4_000;

type InProgress = Pick<Cv, "status" | "busy">;

/** Generation running, or another job (e.g. applying an answer) queued/running. */
export function isCvInProgress(cv: InProgress): boolean {
  return cv.status === "generating" || cv.busy;
}

// 4xx (CV deleted, session gone, ...) will not fix itself by asking again.
function isPermanentFailure(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

/**
 * `refetchInterval` for `useCv`: poll while the CV is in progress, stop once it settles.
 * Transient errors (network, 5xx) keep polling so progress resumes by itself.
 */
export function getCvRefetchInterval(cv: InProgress | undefined, error?: unknown): number | false {
  if (!cv || isPermanentFailure(error)) return false;
  return isCvInProgress(cv) ? CV_POLL_INTERVAL_MS : false;
}

/** `refetchInterval` for `useCvs`: poll while any CV in the list is in progress. */
export function getCvListRefetchInterval(items: CvSummary[] | undefined, error?: unknown): number | false {
  if (!items || isPermanentFailure(error)) return false;
  return items.some(isCvInProgress) ? CV_LIST_POLL_INTERVAL_MS : false;
}
