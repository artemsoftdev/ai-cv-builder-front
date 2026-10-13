import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { isTransientError, isUnauthorizedError } from "@/lib/api/errors";

export const MAX_QUERY_RETRIES = 3;

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return isTransientError(error) && failureCount < MAX_QUERY_RETRIES;
}

function retryDelay(attempt: number): number {
  return Math.min(1_000 * 2 ** attempt, 8_000);
}

type CreateQueryClientOptions = {
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
