import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";

import { createQueryClient, MAX_QUERY_RETRIES, shouldRetryQuery } from "./query-client";

const apiError = (status: number, code: string) => new ApiError({ status, code, message: code });

describe("shouldRetryQuery", () => {
  it("retries network errors and 5xx a bounded number of times", () => {
    expect(shouldRetryQuery(0, apiError(0, "NETWORK_ERROR"))).toBe(true);
    expect(shouldRetryQuery(0, apiError(503, "INTERNAL"))).toBe(true);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, apiError(503, "INTERNAL"))).toBe(false);
  });

  it("never retries 4xx or unknown errors", () => {
    expect(shouldRetryQuery(0, apiError(401, "UNAUTHORIZED"))).toBe(false);
    expect(shouldRetryQuery(0, apiError(404, "NOT_FOUND"))).toBe(false);
    expect(shouldRetryQuery(0, apiError(429, "RATE_LIMITED"))).toBe(false);
    expect(shouldRetryQuery(0, new Error("bug"))).toBe(false);
  });
});

describe("createQueryClient", () => {
  it("reports UNAUTHORIZED from queries and mutations, but not wrong credentials", async () => {
    const onUnauthorized = vi.fn();
    const client = createQueryClient({ onUnauthorized });

    await client
      .fetchQuery({ queryKey: ["x"], queryFn: () => Promise.reject(apiError(401, "UNAUTHORIZED")) })
      .catch(() => undefined);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    const login = client.getMutationCache().build(client, {
      mutationFn: () => Promise.reject(apiError(401, "INVALID_CREDENTIALS")),
    });
    await login.execute(undefined).catch(() => undefined);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    const save = client.getMutationCache().build(client, {
      mutationFn: () => Promise.reject(apiError(401, "UNAUTHORIZED")),
    });
    await save.execute(undefined).catch(() => undefined);
    expect(onUnauthorized).toHaveBeenCalledTimes(2);
  });
});
