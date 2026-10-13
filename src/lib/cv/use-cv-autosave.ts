"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { Cv, CvContent } from "@/lib/api/types";
import { useUpdateCv } from "@/lib/query/cv-hooks";

import { cvContentSchema } from "./content-schema";
import { mergeContent, type MergeUnit } from "./merge-content";
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

export type CvAutosave = {
  state: SaveState;
  invalid: boolean;
  saveTitle: (title: string) => void;
  dismissFlags: (flagIds: string[]) => void;
  flush: () => Promise<boolean>;
  retry: () => void;
};

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

  // JSON last handed to the queue (or loaded): tells real edits from re-renders and resets.
  const queuedJson = useRef<string | null>(null);
  // Last JSON the change handler saw, to skip notifications without a value change.
  const seenJson = useRef<string | null>(null);
  const invalidRef = useRef(false);
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

  const { subscribe, getValues, trigger, reset } = form;

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

      // Merged local edits may still be invalid; they are saved once they pass.
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
      send: async (patch) => {
        const saved = await updateCv(patch);
        // The server's normalised copy is the base for the next edits.
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
          // Still busy: polling runs and the effect below resumes. Refetch failed: try the PATCH anyway.
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
  }, [subscribe, getValues, trigger, queue]);

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
    const onVisibilityChange = () => {
      // Mobile browsers may kill a background tab without further notice.
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
