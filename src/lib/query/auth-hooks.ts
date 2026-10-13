import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authApi } from "@/lib/api/endpoints";
import { isUnauthorizedError } from "@/lib/api/errors";
import type { Credentials, User } from "@/lib/api/types";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { clearSessionCookie, leaveTo } from "@/lib/auth/session";
import { claimDrafts, clearDrafts } from "@/lib/cv/drafts";
import { flushPendingSaves } from "@/lib/cv/pending-saves";

import { queryKeys } from "./keys";

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async ({ signal }) => {
      const user = await authApi.me(signal);
      claimDrafts(user.id);
      return user;
    },
    staleTime: 5 * 60_000,
  });
}

function useSessionStart(mutationFn: (credentials: Credentials) => Promise<User>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (user) => {
      claimDrafts(user.id);
      // Never show data cached for a previous user of this browser.
      queryClient.removeQueries();
      queryClient.setQueryData(queryKeys.me, user);
    },
  });
}

export function useLogin() {
  return useSessionStart(authApi.login);
}

export function useSignup() {
  return useSessionStart(authApi.signup);
}

async function logout(): Promise<void> {
  await flushPendingSaves();
  try {
    await authApi.logout();
  } catch (error) {
    // Already signed out (expired or revoked): only the stale cookie is left to clear.
    if (!isUnauthorizedError(error)) throw error;
    await clearSessionCookie();
  }
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearDrafts();
      queryClient.clear();
      leaveTo(LOGIN_PATH);
    },
  });
}
