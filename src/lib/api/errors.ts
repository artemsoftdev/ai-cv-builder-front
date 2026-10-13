import { z } from "zod";

import type { ApiErrorCode, ValidationIssue } from "./types";

type ApiErrorInit = {
  /** HTTP status; 0 when no response was received. */
  status: number;
  code: ApiErrorCode | (string & {});
  message: string;
  details?: Record<string, unknown>;
  /** From the `Retry-After` header (429). */
  retryAfterSeconds?: number;
};

/** Every failure of an API call surfaces as this error (except aborts, which are rethrown as is). */
export class ApiError extends Error {
  override readonly name = "ApiError";
  readonly status: number;
  readonly code: ApiErrorCode | (string & {});
  readonly details: Record<string, unknown> | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor({ status, code, message, details, retryAfterSeconds }: ApiErrorInit) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

/** No response at all, or a server-side failure: worth retrying. */
export function isTransientError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === "NETWORK_ERROR" || error.status >= 500);
}

/** The session is missing or expired (as opposed to wrong credentials on login). */
export function isUnauthorizedError(error: unknown): boolean {
  return isApiError(error, "UNAUTHORIZED");
}

// The error body comes from the network: validate it instead of trusting its shape.
const errorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1).max(64),
    message: z.string().max(1_000),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export function parseErrorBody(body: unknown): z.infer<typeof errorBodySchema>["error"] | null {
  const result = errorBodySchema.safeParse(body);
  return result.success ? result.data.error : null;
}

const issuesSchema = z.array(z.object({ path: z.string(), message: z.string() }));

/** `details.issues` of a VALIDATION_ERROR, or [] when absent or malformed. */
export function getValidationIssues(error: ApiError): ValidationIssue[] {
  if (error.code !== "VALIDATION_ERROR") return [];
  const result = issuesSchema.safeParse(error.details?.issues);
  return result.success ? result.data : [];
}

/** `Retry-After` is either delay-seconds or an HTTP date. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - now) / 1000));
}
