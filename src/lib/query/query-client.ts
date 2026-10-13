import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { isTransientError, isUnauthorizedError } from "@/lib/api/errors";

export const MAX_QUERY_RETRIES = 3;

/**
 * Retry only what can succeed on a second attempt: network failures and 5xx. A 4xx means
 * the request itself is wrong (or the session is gone) and retrying only delays the error.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return isTransientError(error) && failureCount < MAX_QUERY_RETRIES;
}

export function retryDelay(attempt: number): number {
  return Math.min(1_000 * 2 ** attempt, 8_000);
}

type CreateQueryClientOptions = {
  /** Called whenever a query or mutation fails with 401 UNAUTHORIZED. */
  onUnauthorized: () => void;
};

export function createQueryClient({ onUnauthorized }: CreateQueryClientOptions): QueryClient {
  const handleError = (error: unknown) => {
    if (isUnauthorizedError(error)) onUnauthorized();
  };

  return new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: shouldRetryQuery,
        retryDelay,
        refetchOnWindowFocus: true,
      },
      mutations: {
        // Writes are not idempotent (creating a CV twice costs a generation); never auto-retry.
        retry: false,
      },
    },
  });
}
