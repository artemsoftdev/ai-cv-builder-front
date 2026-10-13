import { ApiError } from "@/lib/api/errors";
import type { Cv, CvSummary } from "@/lib/api/types";

export const CV_POLL_INTERVAL_MS = 1_500;
export const CV_LIST_POLL_INTERVAL_MS = 4_000;

type InProgress = Pick<Cv, "status" | "busy">;

function isCvInProgress(cv: InProgress): boolean {
  return cv.status === "generating" || cv.busy;
}

// 4xx (CV deleted, session gone) will not fix itself by asking again.
function isPermanentFailure(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

export function getCvRefetchInterval(cv: InProgress | undefined, error?: unknown): number | false {
  if (!cv || isPermanentFailure(error)) return false;
  return isCvInProgress(cv) ? CV_POLL_INTERVAL_MS : false;
}

export function getCvListRefetchInterval(items: CvSummary[] | undefined, error?: unknown): number | false {
  if (!items || isPermanentFailure(error)) return false;
  return items.some(isCvInProgress) ? CV_LIST_POLL_INTERVAL_MS : false;
}
