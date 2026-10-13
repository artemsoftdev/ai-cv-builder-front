"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Target } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import type { CvContent } from "@/lib/api/types";
import { cvContentSchema } from "@/lib/cv/content-schema";
import type { ReadyCv } from "@/lib/cv/ready-cv";
import type { CvPatch } from "@/lib/cv/save-queue";
import type { CvSectionKey } from "@/lib/cv/sections";
import { useCvAutosave } from "@/lib/cv/use-cv-autosave";
import { useFocusOnMount } from "@/lib/hooks/use-focus-on-mount";

import { BackToCvsLink } from "../cv-page-shell";
import { CvEditor } from "../editor/cv-editor";
import { BusyBanner } from "./busy-banner";
import { SaveStatus } from "./save-status";
import { TitleEditor } from "./title-editor";

type CvWorkspaceProps = {
  cv: ReadyCv;
  dataUpdatedAt: number;
  /** Polling failed (network, 5xx); it keeps trying. */
  refetchFailed: boolean;
  onRetryRefetch: () => void;
  /** Focus the title (the CV just finished generating while the page was open). */
  autoFocus?: boolean;
};

const NO_SECTIONS: ReadonlySet<CvSectionKey> = new Set();
const HIGHLIGHT_MS = 2_600;

/** Editor for a generated CV, saved automatically. */
export function CvWorkspace({ cv, dataUpdatedAt, refetchFailed, onRetryRefetch, autoFocus = false }: CvWorkspaceProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useFocusOnMount(headingRef, autoFocus);

  const form = useForm<CvContent>({
    resolver: zodResolver(cvContentSchema),
    // A copy: RHF mutates its values in place and must never touch the query cache.
    defaultValues: structuredClone(cv.content),
    mode: "onChange",
  });

  // Shown until the server confirms the rename (or wins a conflict).
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const [updatedSections, setUpdatedSections] = useState<ReadonlySet<CvSectionKey>>(NO_SECTIONS);

  const handleSaved = useCallback((patch: CvPatch) => {
    if (patch.title !== undefined) setPendingTitle((current) => (current === patch.title ? null : current));
  }, []);

  const handleConflict = useCallback(() => {
    setPendingTitle(null);
    toast.warning("This CV changed elsewhere — reloaded the latest version", {
      description: "Your most recent edit could not be applied on top of it.",
    });
  }, []);

  const autosave = useCvAutosave({
    cv,
    dataUpdatedAt,
    form,
    onSaved: handleSaved,
    onConflict: handleConflict,
    onRemoteUpdate: (sections) => setUpdatedSections(new Set(sections)),
  });

  useEffect(() => {
    if (updatedSections.size === 0) return;
    const timer = setTimeout(() => setUpdatedSections(NO_SECTIONS), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [updatedSections]);

  const renameCv = (title: string) => {
    setPendingTitle(title);
    autosave.saveTitle(title);
  };

  const retrySave = () => {
    // After a conflict there is nothing to resend: what is missing is the latest version.
    if (autosave.state.status === "conflict") onRetryRefetch();
    else autosave.retry();
  };

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
        <header className="space-y-3">
          <BackToCvsLink />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1 space-y-1">
              <TitleEditor
                title={pendingTitle ?? cv.title}
                onSave={renameCv}
                disabled={cv.busy}
                headingRef={headingRef}
              />
              <p className="flex min-w-0 items-center gap-1.5 text-sm text-fg-muted">
                <Target aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
                <span className="sr-only">Target role:</span>
                <span className="truncate">{cv.targetRole}</span>
              </p>
            </div>
            <SaveStatus state={autosave.state} invalid={autosave.invalid} onRetry={retrySave} className="shrink-0" />
          </div>
        </header>

        {cv.busy && <BusyBanner connectionLost={refetchFailed} />}

        <form noValidate onSubmit={(event) => event.preventDefault()}>
          <CvEditor targetRole={cv.targetRole} readOnly={cv.busy} updatedSections={updatedSections} />
        </form>
      </div>
    </FormProvider>
  );
}
