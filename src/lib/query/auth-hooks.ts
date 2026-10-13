import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authApi } from "@/lib/api/endpoints";
import type { Credentials, User } from "@/lib/api/types";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { leaveTo } from "@/lib/auth/session";

import { queryKeys } from "./keys";

/** The signed-in user. A 401 here triggers the global redirect to /login. */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => authApi.me(signal),
    staleTime: 5 * 60_000,
  });
}

function useSessionStart(mutationFn: (credentials: Credentials) => Promise<User>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (user) => {
      // Never show data cached for a previous user of this browser.
      queryClient.removeQueries();
      queryClient.setQueryData(queryKeys.me, user);
    },
  });
}

/** `mutate({ email, password })`; errors: INVALID_CREDENTIALS, RATE_LIMITED, VALIDATION_ERROR. */
export function useLogin() {
  return useSessionStart(authApi.login);
}

/** `mutate({ email, password })`; errors: EMAIL_TAKEN, RATE_LIMITED, VALIDATION_ERROR. */
export function useSignup() {
  return useSessionStart(authApi.signup);
}

/** Ends the session server-side, then reloads into /login with an empty cache. */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.clear();
      leaveTo(LOGIN_PATH);
    },
  });
}
