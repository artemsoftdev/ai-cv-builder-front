import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { cvsApi } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/errors";
import type { CreateCvInput, Cv, CvSummary, UpdateCvInput } from "@/lib/api/types";
import { saveFile } from "@/lib/utils/save-file";

import { queryKeys } from "./keys";
import { getCvListRefetchInterval, getCvRefetchInterval } from "./polling";

// ---------------------------------------------------------------------------- queries

/** All CVs of the user, newest first. Polls while any of them is generating/busy. */
export function useCvs() {
  return useQuery({
    queryKey: queryKeys.cvs,
    queryFn: ({ signal }) => cvsApi.list(signal),
    // Cheap request, and statuses change in the background: refresh whenever the list is shown.
    staleTime: 0,
    refetchInterval: (query) => getCvListRefetchInterval(query.state.data, query.state.error),
  });
}

/**
 * One CV. Polls every 1.5 s while `status === 'generating' || busy` and stops once it
 * settles; since all progress lives on the server, a reload simply resumes polling.
 */
export function useCv(id: string) {
  return useQuery({
    queryKey: queryKeys.cv(id),
    queryFn: ({ signal }) => cvsApi.get(id, signal),
    refetchInterval: (query) => getCvRefetchInterval(query.state.data, query.state.error),
  });
}

// ---------------------------------------------------------------------------- cache helpers

/** Stores a CV returned by a mutation and marks the list (which summarises it) stale. */
function storeCv(queryClient: QueryClient, cv: Cv): void {
  queryClient.setQueryData(queryKeys.cv(cv.id), cv);
  void queryClient.invalidateQueries({ queryKey: queryKeys.cvs });
}

/**
 * Shared lifecycle of mutations returning `{ cv }`:
 * - before sending, cancel an in-flight GET of the same CV, otherwise its (older) response
 *   could land after ours and e.g. hide `busy: true`, which would stop polling;
 * - on success, the response is the new truth;
 * - on failure (VERSION_CONFLICT, CV_BUSY, ...) refetch so the UI shows the server state.
 */
function useCvMutation<TVariables>(cvId: string, mutationFn: (variables: TVariables) => Promise<Cv>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.cv(cvId) });
    },
    onSuccess: (cv) => storeCv(queryClient, cv),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv(cvId) });
    },
  });
}

// ---------------------------------------------------------------------------- mutations

/** `mutate({ targetRole, text })` or `mutate({ targetRole, file })`; resolves to the new CV (202, generating). */
export function useCreateCv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCvInput) => cvsApi.create(input),
    onSuccess: (cv) => storeCv(queryClient, cv),
  });
}

/** `mutate({ version, title?, content?, dismissFlagIds? })`. Errors: VERSION_CONFLICT, CV_BUSY, VALIDATION_ERROR. */
export function useUpdateCv(cvId: string) {
  return useCvMutation(cvId, (patch: UpdateCvInput) => cvsApi.update(cvId, patch));
}

/** `mutate()`; only valid for a `failed` CV. */
export function useRetryCv(cvId: string) {
  return useCvMutation(cvId, () => cvsApi.retry(cvId));
}

/** `mutate({ questionId, answer })`; the CV becomes `busy` while the answer is applied. */
export function useAnswerQuestion(cvId: string) {
  return useCvMutation(cvId, ({ questionId, answer }: { questionId: string; answer: string }) =>
    cvsApi.answerQuestion(cvId, questionId, answer),
  );
}

/** `mutate(questionId)` */
export function useDismissQuestion(cvId: string) {
  return useCvMutation(cvId, (questionId: string) => cvsApi.dismissQuestion(cvId, questionId));
}

type DeleteContext = { removed: CvSummary | undefined; index: number };

const deleteCvMutationKey = ["cvs", "delete"] as const;

/**
 * `mutate(cvId)`. Optimistically removes the CV from the list and puts it back (at the same
 * position) if the request fails. A 404 counts as success: the CV is gone either way.
 */
export function useDeleteCv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: deleteCvMutationKey,
    mutationFn: async (cvId: string) => {
      try {
        await cvsApi.remove(cvId);
      } catch (error) {
        if (!isApiError(error, "NOT_FOUND")) throw error;
      }
    },
    onMutate: async (cvId): Promise<DeleteContext> => {
      await queryClient.cancelQueries({ queryKey: queryKeys.cvs });
      const items = queryClient.getQueryData<CvSummary[]>(queryKeys.cvs) ?? [];
      const index = items.findIndex((cv) => cv.id === cvId);
      queryClient.setQueryData<CvSummary[]>(queryKeys.cvs, (current) => current?.filter((cv) => cv.id !== cvId));
      return { removed: items[index], index };
    },
    onError: (_error, _cvId, context) => {
      const removed = context?.removed;
      if (!removed) return;
      queryClient.setQueryData<CvSummary[]>(queryKeys.cvs, (current = []) => {
        if (current.some((cv) => cv.id === removed.id)) return current;
        const next = [...current];
        next.splice(Math.min(context.index, next.length), 0, removed);
        return next;
      });
    },
    onSuccess: (_data, cvId) => {
      queryClient.removeQueries({ queryKey: queryKeys.cv(cvId) });
    },
    onSettled: async () => {
      // With several deletes in flight, refetching after the first would bring back the
      // others for a moment; resync once, after the last one.
      if (queryClient.isMutating({ mutationKey: deleteCvMutationKey }) === 1) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.cvs });
      }
    },
  });
}

/** `mutate(fallbackFilename)`: downloads the A4 PDF and hands it to the browser. Errors: CV_NOT_READY. */
export function useDownloadCvPdf(cvId: string) {
  return useMutation({
    mutationFn: async (fallbackFilename: string) => {
      const { blob, filename } = await cvsApi.downloadPdf(cvId);
      saveFile(blob, filename ?? fallbackFilename);
    },
  });
}
