"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Path, UseFormReturn } from "react-hook-form";

import { cvsApi } from "@/lib/api/endpoints";
import { getValidationIssues, isApiError } from "@/lib/api/errors";
import type { Cv, CvContent } from "@/lib/api/types";
import { isLeaving } from "@/lib/auth/session";
import { useUpdateCv } from "@/lib/query/cv-hooks";
import { queryKeys } from "@/lib/query/keys";

import { cvContentSchema } from "./content-schema";
import { removeDraft, writeDraft } from "./drafts";
import { mergeContent, type MergeUnit } from "./merge-content";
import { registerFlush } from "./pending-saves";
import { SaveQueue, type CvPatch, type SaveState } from "./save-queue";
import { changedSections, type CvSectionKey } from "./sections";

type RefetchCv = () => Promise<{ isSuccess: boolean; data?: Cv | undefined }>;

export type ConflictResolution = {
  kept: MergeUnit[];
  dropped: MergeUnit[];
};

type UseCvAutosaveOptions = {
  cv: Cv;
  refetch: RefetchCv;
  form: UseFormReturn<CvContent>;
  onConflict?: (resolution: ConflictResolution) => void;
  onRemoteUpdate?: (sections: CvSectionKey[]) => void;
  onSaved?: (patch: CvPatch) => void;
  debounceMs?: number;
};

type CvAutosave = {
  state: SaveState;
  invalid: boolean;
  saveTitle: (title: string) => void;
  dismissFlags: (flagIds: string[]) => void;
  flush: () => Promise<boolean>;
  retry: () => void;
};

export const LEAVE_WITH_UNSAVED_EDITS = "Your latest edits aren't saved yet. Leave this page anyway?";

const UNSAVABLE_STATES: ReadonlySet<SaveState["status"]> = new Set(["error", "waiting", "conflict"]);

export function useCvAutosave({
  cv,
  refetch,
  form,
  onConflict,
  onRemoteUpdate,
  onSaved,
  debounceMs,
}: UseCvAutosaveOptions): CvAutosave {
  const cvId = cv.id;
  const queryClient = useQueryClient();
  const { mutateAsync: updateCv } = useUpdateCv(cvId);
  const [state, setState] = useState<SaveState>({ status: "saved" });
  const [queue] = useState(() => new SaveQueue(cv.version, { debounceMs }));
  // The form may start from a restored draft rather than from the server copy.
  const [startsUnsaved] = useState(() => JSON.stringify(form.getValues()) !== JSON.stringify(cv.content));
  const [invalid, setInvalid] = useState(() => startsUnsaved && !cvContentSchema.safeParse(form.getValues()).success);

  // JSON last handed to the queue (or loaded): tells real edits from re-renders and resets.
  const queuedJson = useRef<string | null>(null);
  // Last JSON the change handler saw, to skip notifications without a value change.
  const seenJson = useRef<string | null>(null);
  const invalidRef = useRef(invalid);
  // Server content at queue.version: the base of a merge.
  const baseContent = useRef(cv.content);
  // Version the last merge was re-sent onto; cleared by any successful save.
  const mergedOnto = useRef<number | null>(null);
  // After CV_BUSY: true once data fetched after the error has arrived, so cv.busy is current.
  const busyChecked = useRef(false);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  useEffect(() => {
    onRemoteUpdateRef.current = onRemoteUpdate;
  });

  const { subscribe, getValues, trigger, reset, setError } = form;

  const saveDraft = useCallback(
    (content: CvContent) => {
      if (baseContent.current) writeDraft(cvId, { version: queue.version, base: baseContent.current, content });
    },
    [cvId, queue],
  );

  const showServerContent = useCallback(
    (latest: Cv & { content: CvContent }, shown: CvContent = latest.content) => {
      // What the server changed, not the form's unsaved whitespace the API normalised away.
      const sections = changedSections(baseContent.current ?? latest.content, latest.content);
      const serverJson = JSON.stringify(latest.content);
      const shownJson = JSON.stringify(shown);
      baseContent.current = latest.content;
      queue.reset(latest.version);
      seenJson.current = shownJson;
      // A copy: RHF mutates its values in place and must never touch the query cache.
      reset(structuredClone(shown));

      // Merged local edits may still be invalid; they are saved once they pass.
      const valid = shownJson === serverJson || cvContentSchema.safeParse(shown).success;
      invalidRef.current = !valid;
      setInvalid(!valid);
      queuedJson.current = valid ? shownJson : serverJson;
      if (!valid) void trigger();
      else if (shownJson !== serverJson) queue.schedule({ content: structuredClone(shown) }, { immediate: true });
      if (shownJson !== serverJson) saveDraft(shown);

      if (sections.length > 0) onRemoteUpdateRef.current?.(sections);
    },
    [queue, reset, trigger, saveDraft],
  );

  const onConflictRef = useRef(onConflict);
  useEffect(() => {
    onConflictRef.current = onConflict;
  });

  const reloadAfterConflict = useCallback(async () => {
    const result = await refetch();
    const latest = result.data;
    // On failure the status keeps offering "Reload".
    if (!result.isSuccess || !latest?.content || queue.blockedReason !== "conflict") return;
    const merge = baseContent.current ? mergeContent(baseContent.current, getValues(), latest.content) : null;
    const latestCv = { ...latest, content: latest.content };
    // This merge was already rejected on this version: let the server win instead of resending forever.
    if (!merge || mergedOnto.current === latest.version) {
      showServerContent(latestCv);
      onConflictRef.current?.({ kept: [], dropped: merge ? [...merge.kept, ...merge.dropped] : [] });
      return;
    }
    if (merge.kept.length > 0) mergedOnto.current = latest.version;
    showServerContent(latestCv, merge.content);
    onConflictRef.current?.({ kept: merge.kept, dropped: merge.dropped });
  }, [refetch, queue, getValues, showServerContent]);

  // The queue outlives renders: keep its closures current.
  useEffect(() => {
    queue.setHandlers({
      send: async (patch, { keepalive }) => {
        // The page may be going away: start the request now, without the mutation's async setup.
        const saved = keepalive ? await cvsApi.update(cvId, patch, { keepalive }) : await updateCv(patch);
        if (keepalive) queryClient.setQueryData(queryKeys.cv(cvId), saved);
        // The server's normalised copy is the base for the next edits.
        if (saved.content) baseContent.current = saved.content;
        mergedOnto.current = null;
        return { version: saved.version };
      },
      onStateChange: (next) => {
        setState(next);
        if (next.status === "saved" && !invalidRef.current) removeDraft(cvId);
        // Point the API's objections at the fields they are about.
        if (next.status === "error" && isApiError(next.error, "VALIDATION_ERROR")) {
          for (const { path, message } of getValidationIssues(next.error)) {
            if (path.startsWith("content.")) setError(path.slice("content.".length) as Path<CvContent>, { type: "server", message });
          }
        }
      },
      onSaved,
      onConflict: () => void reloadAfterConflict(),
      onBusy: () => {
        busyChecked.current = false;
        void refetch().then((result) => {
          busyChecked.current = true;
          // Still busy: polling runs and the effect below resumes. Refetch failed: try the PATCH anyway.
          if (!result.isSuccess || !result.data?.busy) queue.resume();
        });
      },
    });
  }, [cvId, queue, queryClient, updateCv, refetch, onSaved, reloadAfterConflict, setError]);

  useEffect(() => {
    const initialJson = JSON.stringify(getValues());
    queuedJson.current = initialJson;
    if (startsUnsaved) {
      saveDraft(JSON.parse(initialJson) as CvContent);
      if (invalidRef.current) void trigger();
      else queue.schedule({ content: JSON.parse(initialJson) as CvContent }, { immediate: true });
    }
    return subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        const json = JSON.stringify(values);
        if (json === seenJson.current) return;
        seenJson.current = json;

        const valid = json === queuedJson.current || cvContentSchema.safeParse(values).success;
        invalidRef.current = !valid;
        setInvalid(!valid);
        if (json !== queuedJson.current) saveDraft(JSON.parse(json) as CvContent);
        if (!valid) {
          // Show every blocking error, not only the one in the edited field.
          void trigger();
          return;
        }
        if (json === queuedJson.current) return;
        queuedJson.current = json;
        // Detached copy: RHF keeps mutating its own value objects.
        queue.schedule({ content: JSON.parse(json) as CvContent });
      },
    });
  }, [subscribe, getValues, trigger, queue, saveDraft, startsUnsaved]);

  // Load newer server content unless local edits would be lost; those hit VERSION_CONFLICT and get merged.
  useEffect(() => {
    if (!cv.content || queue.blockedReason === "conflict") return;
    if (cv.version <= queue.version || queue.hasUnsavedChanges) return;
    // Invalid edits are not queued but are still the user's work.
    if (JSON.stringify(getValues()) !== queuedJson.current) return;
    showServerContent({ ...cv, content: cv.content });
  }, [cv, queue, getValues, showServerContent]);

  useEffect(() => {
    if (queue.blockedReason === "busy" && busyChecked.current && !cv.busy) queue.resume();
  }, [cv.busy, state, queue]);

  useEffect(() => {
    const flushBeforeLeaving = () => void queue.flush({ keepalive: true });
    const onVisibilityChange = () => {
      // Mobile browsers may kill a background tab without further notice.
      if (document.visibilityState === "hidden") flushBeforeLeaving();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // An auth redirect must not be held up: nothing can be saved after a 401, and the draft survives.
      if (isLeaving() || (!queue.hasUnsavedChanges && !invalidRef.current)) return;
      event.preventDefault();
      // Older Safari only shows the prompt when returnValue is set.
      event.returnValue = "";
    };
    // In-app navigation never fires beforeunload: ask when the edits can't be saved right now.
    const onLinkClick = (event: MouseEvent) => {
      if (!invalidRef.current && !UNSAVABLE_STATES.has(queue.state.status)) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm(LEAVE_WITH_UNSAVED_EDITS)) event.preventDefault();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flushBeforeLeaving);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("click", onLinkClick, true);
    const unregister = registerFlush(() => queue.flush());
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flushBeforeLeaving);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("click", onLinkClick, true);
      unregister();
      flushBeforeLeaving();
    };
  }, [queue]);

  const actions = useMemo(
    () => ({
      saveTitle: (title: string) => queue.schedule({ title }, { immediate: true }),
      dismissFlags: (flagIds: string[]) => queue.schedule({ dismissFlagIds: flagIds }, { immediate: true }),
      flush: () => queue.flush(),
      retry: () => {
        if (queue.blockedReason === "conflict") void reloadAfterConflict();
        else queue.retry();
      },
    }),
    [queue, reloadAfterConflict],
  );

  return { state, invalid, ...actions };
}
