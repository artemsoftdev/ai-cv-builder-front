"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { Cv, CvContent } from "@/lib/api/types";
import { useUpdateCv } from "@/lib/query/cv-hooks";

import { cvContentSchema } from "./content-schema";
import { SaveQueue, type CvPatch, type SaveState } from "./save-queue";
import { changedSections, type CvSectionKey } from "./sections";

/** `useCv().refetch` (a refetch never throws; failures come back in the result). */
type RefetchCv = () => Promise<{ isSuccess: boolean; data?: Cv | undefined }>;

type UseCvAutosaveOptions = {
  /** Latest server state of the CV (from `useCv`); must have content. */
  cv: Cv;
  /** Reloads the server copy, to recover from `VERSION_CONFLICT` and `CV_BUSY`. */
  refetch: RefetchCv;
  form: UseFormReturn<CvContent>;
  /** A save hit `VERSION_CONFLICT`; the latest version is loaded into the form next. */
  onConflict?: () => void;
  /** The form was replaced with newer server content (e.g. an answer was applied). */
  onRemoteUpdate?: (sections: CvSectionKey[]) => void;
  onSaved?: (patch: CvPatch) => void;
  debounceMs?: number;
};

export type CvAutosave = {
  state: SaveState;
  /** The form has edits that fail validation, so they are not being saved. */
  invalid: boolean;
  saveTitle: (title: string) => void;
  dismissFlags: (flagIds: string[]) => void;
  /** Sends pending edits now; `true` once the server has everything. */
  flush: () => Promise<boolean>;
  /** After an error: send again. After a conflict: load the latest version again. */
  retry: () => void;
};

/**
 * Autosave for the CV editor:
 * - valid form edits are PATCHed ~1 s after the last change, one request at a time, each
 *   carrying the version returned by the previous one (see `SaveQueue`);
 * - the title and dismissed review flags go through the same queue so they never race it;
 * - newer server content (an AI update) replaces the form only when nothing local is unsaved;
 *   otherwise the next save gets `VERSION_CONFLICT` and the server copy is loaded instead;
 * - `CV_BUSY` keeps the edits and sends them once a fresh fetch shows the job has finished;
 * - pending edits are sent when the tab is hidden or the editor unmounts, and leaving the page
 *   with unsaved edits asks for confirmation.
 */
export function useCvAutosave({
  cv,
  refetch,
  form,
  onConflict,
  onRemoteUpdate,
  onSaved,
  debounceMs,
}: UseCvAutosaveOptions): CvAutosave {
  const { mutateAsync: updateCv } = useUpdateCv(cv.id);
  const [state, setState] = useState<SaveState>({ status: "saved" });
  const [invalid, setInvalid] = useState(false);
  const [queue] = useState(() => new SaveQueue(cv.version, { debounceMs }));

  // JSON of the content last handed to the queue (or loaded from the server): the baseline
  // that tells "the user changed something" from re-renders and resets.
  const queuedJson = useRef<string | null>(null);
  // Last JSON the change handler looked at, to skip notifications without a value change.
  const seenJson = useRef<string | null>(null);
  const invalidRef = useRef(false);
  // After CV_BUSY: set once data fetched after the error has arrived, so `cv.busy` is current.
  const busyChecked = useRef(false);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  useEffect(() => {
    onRemoteUpdateRef.current = onRemoteUpdate;
  });

  const { subscribe, getValues, trigger, reset } = form;

  /** Replaces the form with the server's content and continues from its version. */
  const applyServerContent = useCallback(
    (latest: Cv) => {
      if (!latest.content) return;
      const sections = changedSections(getValues(), latest.content);
      const json = JSON.stringify(latest.content);
      queuedJson.current = json;
      seenJson.current = json;
      invalidRef.current = false;
      setInvalid(false);
      queue.reset(latest.version);
      // Never hand the query cache's object to RHF, which mutates its values in place.
      reset(structuredClone(latest.content));
      if (sections.length > 0) onRemoteUpdateRef.current?.(sections);
    },
    [queue, getValues, reset],
  );

  const reloadAfterConflict = useCallback(async () => {
    const result = await refetch();
    // On failure the status keeps offering "Reload".
    if (result.isSuccess && result.data && queue.blockedReason === "conflict") applyServerContent(result.data);
  }, [refetch, queue, applyServerContent]);

  // The queue outlives renders: keep its closures current.
  useEffect(() => {
    queue.setHandlers({
      send: async (patch) => ({ version: (await updateCv(patch)).version }),
      onStateChange: setState,
      onSaved,
      onConflict: () => {
        onConflict?.();
        void reloadAfterConflict();
      },
      onBusy: () => {
        busyChecked.current = false;
        void refetch().then((result) => {
          busyChecked.current = true;
          // Still busy: polling runs, and the effect below resumes when the job is done.
          // Refetch failed: try the PATCH again anyway; it reports what is going on.
          if (!result.isSuccess || !result.data?.busy) queue.resume();
        });
      },
    });
  }, [queue, updateCv, refetch, onSaved, onConflict, reloadAfterConflict]);

  useEffect(() => {
    queuedJson.current = JSON.stringify(getValues());
    return subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        const json = JSON.stringify(values);
        if (json === seenJson.current) return;
        seenJson.current = json;

        const valid = json === queuedJson.current || cvContentSchema.safeParse(values).success;
        invalidRef.current = !valid;
        setInvalid(!valid);
        if (!valid) {
          // Make sure every blocking error is visible, not only the one in the edited field.
          void trigger();
          return;
        }
        if (json === queuedJson.current) return;
        queuedJson.current = json;
        // A detached copy: RHF keeps mutating its own value objects.
        queue.schedule({ content: JSON.parse(json) as CvContent });
      },
    });
  }, [subscribe, getValues, trigger, queue]);

  // Newer server content (an AI update, another device): load it unless that would throw away
  // local edits. Those go out with the old version, get VERSION_CONFLICT, and the server wins.
  useEffect(() => {
    if (!cv.content || queue.blockedReason === "conflict") return;
    if (cv.version <= queue.version || queue.hasUnsavedChanges) return;
    // Invalid edits are not queued but are still the user's work.
    if (JSON.stringify(getValues()) !== queuedJson.current) return;
    applyServerContent(cv);
  }, [cv, queue, getValues, applyServerContent]);

  // CV_BUSY: send the kept edits once fresh data shows the job has finished.
  useEffect(() => {
    if (queue.blockedReason === "busy" && busyChecked.current && !cv.busy) queue.resume();
  }, [cv.busy, state, queue]);

  useEffect(() => {
    const onVisibilityChange = () => {
      // Mobile browsers may kill a backgrounded tab without further notice.
      if (document.visibilityState === "hidden") void queue.flush();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!queue.hasUnsavedChanges && !invalidRef.current) return;
      event.preventDefault();
      // Older Safari only shows the prompt when returnValue is set.
      event.returnValue = "";
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Navigating away inside the app: send what is still waiting for the debounce.
      void queue.flush();
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
