"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { Cv, CvContent } from "@/lib/api/types";
import { useUpdateCv } from "@/lib/query/cv-hooks";

import { cvContentSchema } from "./content-schema";
import { mergeContent, type MergeUnit } from "./merge-content";
import { SaveQueue, type CvPatch, type SaveState } from "./save-queue";
import { changedSections, type CvSectionKey } from "./sections";

/** `useCv().refetch` (a refetch never throws; failures come back in the result). */
type RefetchCv = () => Promise<{ isSuccess: boolean; data?: Cv | undefined }>;

/** How a `VERSION_CONFLICT` was resolved (see `mergeContent`). */
export type ConflictResolution = {
  /** Local edits re-applied on top of the latest version (and saved again). */
  kept: MergeUnit[];
  /** Local edits replaced by the latest version, which changed the same part. */
  dropped: MergeUnit[];
};

type UseCvAutosaveOptions = {
  /** Latest server state of the CV (from `useCv`); must have content. */
  cv: Cv;
  /** Reloads the server copy, to recover from `VERSION_CONFLICT` and `CV_BUSY`. */
  refetch: RefetchCv;
  form: UseFormReturn<CvContent>;
  /**
   * A save hit `VERSION_CONFLICT` and the latest version is now in the form, merged with the
   * local edits where they don't collide. Queued renames and flag dismissals are dropped.
   */
  onConflict?: (resolution: ConflictResolution) => void;
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
 *   otherwise the next save gets `VERSION_CONFLICT`: the latest version is loaded and local
 *   edits to the parts it did not change are re-applied and saved (`mergeContent`);
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
  // Server content at `queue.version`: what local edits are based on (the base of a merge).
  const baseContent = useRef(cv.content);
  // Server version the last merge was re-sent onto; cleared by any successful save.
  const mergedOnto = useRef<number | null>(null);
  // After CV_BUSY: set once data fetched after the error has arrived, so `cv.busy` is current.
  const busyChecked = useRef(false);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  useEffect(() => {
    onRemoteUpdateRef.current = onRemoteUpdate;
  });

  const { subscribe, getValues, trigger, reset } = form;

  /**
   * Continues from the server's version of the CV, showing `shown`: the server content itself,
   * or a merge of it with local edits, which is then saved on top of it.
   */
  const showServerContent = useCallback(
    (latest: Cv & { content: CvContent }, shown: CvContent = latest.content) => {
      const sections = changedSections(getValues(), shown);
      const serverJson = JSON.stringify(latest.content);
      const shownJson = JSON.stringify(shown);
      baseContent.current = latest.content;
      queue.reset(latest.version);
      seenJson.current = shownJson;
      // A copy: RHF mutates its values in place and must never touch the query cache.
      reset(structuredClone(shown));

      // Merged local edits may still be invalid (being fixed); they are saved once they pass.
      const valid = shownJson === serverJson || cvContentSchema.safeParse(shown).success;
      invalidRef.current = !valid;
      setInvalid(!valid);
      queuedJson.current = valid ? shownJson : serverJson;
      if (!valid) void trigger();
      else if (shownJson !== serverJson) queue.schedule({ content: structuredClone(shown) }, { immediate: true });

      if (sections.length > 0) onRemoteUpdateRef.current?.(sections);
    },
    [queue, getValues, reset, trigger],
  );

  const onConflictRef = useRef(onConflict);
  useEffect(() => {
    onConflictRef.current = onConflict;
  });

  /** After `VERSION_CONFLICT`: load the latest version and re-apply what doesn't collide. */
  const reloadAfterConflict = useCallback(async () => {
    const result = await refetch();
    const latest = result.data;
    // On failure the status keeps offering "Reload".
    if (!result.isSuccess || !latest?.content || queue.blockedReason !== "conflict") return;
    // The form holds the rejected edit and anything typed since.
    const merge = baseContent.current ? mergeContent(baseContent.current, getValues(), latest.content) : null;
    const latestCv = { ...latest, content: latest.content };
    // A merge re-sent onto this very version was rejected again: with a consistent server that
    // can't happen, so rather than merge and resend forever, the server copy wins this time.
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
      send: async (patch) => {
        const saved = await updateCv(patch);
        // The server's copy (trimmed, normalised) is what the next edits are based on.
        if (saved.content) baseContent.current = saved.content;
        mergedOnto.current = null;
        return { version: saved.version };
      },
      onStateChange: setState,
      onSaved,
      onConflict: () => void reloadAfterConflict(),
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
  }, [queue, updateCv, refetch, onSaved, reloadAfterConflict]);

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
    showServerContent({ ...cv, content: cv.content });
  }, [cv, queue, getValues, showServerContent]);

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
