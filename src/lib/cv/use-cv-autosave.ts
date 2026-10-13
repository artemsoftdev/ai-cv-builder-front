"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { Cv, CvContent } from "@/lib/api/types";
import { useUpdateCv } from "@/lib/query/cv-hooks";

import { cvContentSchema } from "./content-schema";
import { SaveQueue, type CvPatch, type SaveState } from "./save-queue";
import { changedSections, type CvSectionKey } from "./sections";

type UseCvAutosaveOptions = {
  /** Latest server state of the CV (from `useCv`); must have content. */
  cv: Cv;
  /** `useCv().dataUpdatedAt`: lets us tell data fetched after a conflict from older data. */
  dataUpdatedAt: number;
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
  retry: () => void;
};

/**
 * Autosave for the CV editor:
 * - valid form edits are PATCHed ~1 s after the last change, one request at a time, each
 *   carrying the version returned by the previous one (see `SaveQueue`);
 * - the title and dismissed review flags go through the same queue so they never race it;
 * - newer server content (an AI update) replaces the form only when nothing local is unsaved;
 *   otherwise the next save gets `VERSION_CONFLICT` and the server copy is loaded instead;
 * - pending edits are sent when the tab is hidden or the editor unmounts, and leaving the page
 *   with unsaved edits asks for confirmation.
 */
export function useCvAutosave({
  cv,
  dataUpdatedAt,
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
  // The queue outlives renders: keep its closures current.
  useEffect(() => {
    queue.setHandlers({
      send: async (patch) => ({ version: (await updateCv(patch)).version }),
      onStateChange: setState,
      onSaved,
      onConflict,
    });
  }, [queue, updateCv, onSaved, onConflict]);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  useEffect(() => {
    onRemoteUpdateRef.current = onRemoteUpdate;
  });

  // JSON of the content last handed to the queue (or loaded from the server): the baseline
  // that tells "the user changed something" from re-renders and resets.
  const queuedJson = useRef<string | null>(null);
  // Last JSON the change handler looked at, to skip notifications without a value change.
  const seenJson = useRef<string | null>(null);
  const invalidRef = useRef(false);

  const { subscribe, getValues, trigger, reset } = form;

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

  // Newer server content: load it into the form, unless that would throw away local edits.
  useEffect(() => {
    const content = cv.content;
    if (!content) return;
    if (queue.blockedReason === "conflict") {
      // Wait for data fetched after the conflict (the update hook refetches on error).
      if (dataUpdatedAt <= (queue.blockedSince ?? Number.POSITIVE_INFINITY)) return;
    } else {
      if (cv.version <= queue.version || queue.hasUnsavedChanges) return;
      // Invalid edits are not queued but are still the user's work.
      if (JSON.stringify(getValues()) !== queuedJson.current) return;
    }

    const sections = changedSections(getValues(), content);
    const json = JSON.stringify(content);
    queuedJson.current = json;
    seenJson.current = json;
    invalidRef.current = false;
    setInvalid(false);
    queue.reset(cv.version);
    // Never hand the query cache's object to RHF, which mutates its values in place.
    reset(structuredClone(content));
    if (sections.length > 0) onRemoteUpdateRef.current?.(sections);
  }, [cv.version, cv.content, dataUpdatedAt, queue, getValues, reset]);

  // CV_BUSY: retry once fresh data shows the job has finished.
  useEffect(() => {
    if (queue.blockedReason !== "busy" || cv.busy) return;
    if (dataUpdatedAt > (queue.blockedSince ?? Number.POSITIVE_INFINITY)) queue.resume();
  }, [cv.busy, dataUpdatedAt, state, queue]);

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
      retry: () => queue.retry(),
    }),
    [queue],
  );

  return { state, invalid, ...actions };
}
