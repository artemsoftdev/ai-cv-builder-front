import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { cvsApi } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/errors";
import type { CreateCvInput, Cv, CvSummary, UpdateCvInput } from "@/lib/api/types";
import { saveFile } from "@/lib/utils/save-file";

import { queryKeys } from "./keys";
import { getCvListRefetchInterval, getCvRefetchInterval } from "./polling";

export function useCvs() {
  return useQuery({
    queryKey: queryKeys.cvs,
    queryFn: ({ signal }) => cvsApi.list(signal),
    // Cheap request whose statuses change in the background: refresh whenever the list is shown.
    staleTime: 0,
    refetchInterval: (query) => getCvListRefetchInterval(query.state.data, query.state.error),
  });
}

export function useCv(id: string) {
  return useQuery({
    queryKey: queryKeys.cv(id),
    queryFn: ({ signal }) => cvsApi.get(id, signal),
    refetchInterval: (query) => getCvRefetchInterval(query.state.data, query.state.error),
  });
}

function storeCv(queryClient: QueryClient, cv: Cv): void {
  queryClient.setQueryData(queryKeys.cv(cv.id), cv);
  void queryClient.invalidateQueries({ queryKey: queryKeys.cvs });
}

// Cancel in-flight GETs first: an older response landing after ours could hide `busy` and stop polling.
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

export function useCreateCv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCvInput) => cvsApi.create(input),
    onSuccess: (cv) => storeCv(queryClient, cv),
  });
}

export function useUpdateCv(cvId: string) {
  return useCvMutation(cvId, (patch: UpdateCvInput) => cvsApi.update(cvId, patch));
}

export function useRetryCv(cvId: string) {
  return useCvMutation(cvId, () => cvsApi.retry(cvId));
}

export function useAnswerQuestion(cvId: string) {
  return useCvMutation(cvId, ({ questionId, answer }: { questionId: string; answer: string }) =>
    cvsApi.answerQuestion(cvId, questionId, answer),
  );
}

export function useDismissQuestion(cvId: string) {
  return useCvMutation(cvId, (questionId: string) => cvsApi.dismissQuestion(cvId, questionId));
}

type DeleteContext = { removed: CvSummary | undefined; index: number };

const deleteCvMutationKey = ["cvs", "delete"] as const;

// Optimistic removal, restored at the same position on failure; 404 counts as success.
export function useDeleteCv() {
  const queryClient = useQueryClient();
  const resync = useRef<ReturnType<typeof setTimeout>>(undefined);
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
    onSettled: () => {
      // Resync once the last of several parallel deletes is done; this one only stops counting after onSettled.
      clearTimeout(resync.current);
      resync.current = setTimeout(() => {
        if (queryClient.isMutating({ mutationKey: deleteCvMutationKey }) > 0) return;
        void queryClient.invalidateQueries({ queryKey: queryKeys.cvs });
      }, 0);
    },
  });
}

export function useDownloadCvPdf(cvId: string) {
  return useMutation({
    mutationFn: async (fallbackFilename: string) => {
      const { blob, filename } = await cvsApi.downloadPdf(cvId);
      saveFile(blob, filename ?? fallbackFilename);
    },
  });
}
