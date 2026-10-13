import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { getErrorMessage } from "@/lib/api/error-messages";
import { getValidationIssues, isApiError } from "@/lib/api/errors";

export const SERVER_ERROR = "root.server" as const;

// VALIDATION_ERROR issues go to the field named by the last path segment; anything else is form-level.
export function applyServerError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): void {
  if (isApiError(error, "VALIDATION_ERROR")) {
    const unmatched: string[] = [];
    let matchedAny = false;
    for (const issue of getValidationIssues(error)) {
      const field = fields.find((name) => name === issue.path.split(".").at(-1));
      if (field) {
        setError(field, { type: "server", message: issue.message });
        matchedAny = true;
      } else {
        unmatched.push(issue.message);
      }
    }
    if (matchedAny && unmatched.length === 0) return;
    setError(SERVER_ERROR, { type: "server", message: unmatched.join(" ") || getErrorMessage(error) });
    return;
  }
  setError(SERVER_ERROR, { type: "server", message: getErrorMessage(error) });
}
