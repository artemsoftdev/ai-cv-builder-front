import { formatDuration } from "@/lib/utils/format";

import { ApiError } from "./errors";
import type { JobErrorCode } from "./types";

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

// The API's messages are written for users; only context-dependent codes are reworded here.
export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC_MESSAGE;
  switch (error.code) {
    case "NETWORK_ERROR":
      return error.message;
    case "RATE_LIMITED":
      return error.retryAfterSeconds
        ? `Too many attempts. Please try again in ${formatDuration(error.retryAfterSeconds)}.`
        : "Too many attempts. Please wait a moment and try again.";
    case "CSRF_CHECK_FAILED":
      return "The request was blocked for security reasons. Reload the page and try again.";
    case "INTERNAL":
      return error.status >= 500 || error.status === 0
        ? "Something went wrong on our side. Please try again in a moment."
        : GENERIC_MESSAGE;
    default:
      return error.message || GENERIC_MESSAGE;
  }
}

// The API's own defaults (job-errors.ts): a failed job stores only the code for questions.
const JOB_ERROR_MESSAGES: Record<JobErrorCode, string> = {
  SOURCE_UNREADABLE: "We couldn't read any text from your source. Try a different PDF or paste the text instead.",
  LLM_NOT_CONFIGURED: "AI generation is not configured on the server.",
  LLM_REFUSED: "The AI declined to process this source.",
  LLM_UNAVAILABLE: "The AI service is unavailable right now. Please try again in a few minutes.",
  LLM_INVALID_OUTPUT: "The AI produced an unusable result. Retrying usually helps.",
  INTERNAL: "Something went wrong while processing your CV. Please try again.",
};

export function describeJobError(code: string | null | undefined): string {
  if (code && Object.hasOwn(JOB_ERROR_MESSAGES, code)) return JOB_ERROR_MESSAGES[code as JobErrorCode];
  return JOB_ERROR_MESSAGES.INTERNAL;
}

export function isRetryableJobError(code: string | null | undefined): boolean {
  return code !== "SOURCE_UNREADABLE";
}

export function describeGenerationLimit(error: unknown): string {
  const retryAfter = error instanceof ApiError ? error.retryAfterSeconds : undefined;
  const wait = retryAfter ? ` You can try again in ${formatDuration(retryAfter)}.` : " Please try again later.";
  return `You can start up to 10 CV generations per hour (retries included), with at most 3 running at the same time.${wait}`;
}
