"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MessageCircleQuestion, Target } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { panelId, tabId } from "@/components/ui/segmented-tabs";
import type { Cv, CvContent } from "@/lib/api/types";
import { cvContentSchema } from "@/lib/cv/content-schema";
import { restoreDraft } from "@/lib/cv/drafts";
import { MERGE_UNIT_LABELS, type MergeUnit } from "@/lib/cv/merge-content";
import type { ReadyCv } from "@/lib/cv/ready-cv";
import type { CvPatch } from "@/lib/cv/save-queue";
import type { CvSectionKey } from "@/lib/cv/sections";
import { useCvAutosave, type ConflictResolution } from "@/lib/cv/use-cv-autosave";
import { useFocusOnMount } from "@/lib/hooks/use-focus-on-mount";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/hooks/use-media-query";

import { BackToCvsLink } from "../cv-page-shell";
import { CvEditor } from "../editor/cv-editor";
import { needsAnswer } from "../questions/question-target";
import { QuestionsPanel } from "../questions/questions-panel";
import { ReviewProvider } from "../review/review-context";
import { ReviewNotice } from "../review/review-notice";
import { CvPreview } from "../preview/cv-preview";
import { BusyBanner } from "./busy-banner";
import { DownloadPdfButton, type SaveCheck } from "./download-pdf-button";
import { focusFirstInvalidField } from "./focus-invalid-field";
import { MobileActionBar } from "./mobile-action-bar";
import { SaveStatus } from "./save-status";
import { TitleEditor } from "./title-editor";
import { parseWorkspaceTab, WorkspaceTabs, type WorkspaceTab } from "./workspace-tabs";

type CvWorkspaceProps = {
  cv: ReadyCv;
  refetch: () => Promise<{ isSuccess: boolean; data?: Cv | undefined }>;
  refetchFailed: boolean;
  autoFocus?: boolean;
};

const NO_SECTIONS: ReadonlySet<CvSectionKey> = new Set();
const HIGHLIGHT_MS = 2_600;
const APP_HEADER_PX = 64;

const describeUnits = (units: MergeUnit[]) => units.map((unit) => MERGE_UNIT_LABELS[unit]).join(", ");

export function CvWorkspace({ cv, refetch, refetchFailed, autoFocus = false }: CvWorkspaceProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useFocusOnMount(headingRef, autoFocus);

  const [restored] = useState(() => restoreDraft(cv));
  // A copy: RHF mutates its values in place and must never touch the query cache.
  const [initialContent] = useState(() => structuredClone(restored?.content ?? cv.content));
  const form = useForm<CvContent>({
    resolver: zodResolver(cvContentSchema),
    defaultValues: initialContent,
    mode: "onChange",
  });

  useEffect(() => {
    if (!restored) return;
    toast.info("Restored your unsaved edits", {
      description:
        restored.dropped.length > 0
          ? `Your edits to ${describeUnits(restored.dropped)} were replaced by a newer version.`
          : undefined,
    });
  }, [restored]);

  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const tabsId = useId();
  const tabsRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLFormElement>(null);
  const activeTab = parseWorkspaceTab(useSearchParams().get("tab"));

  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const [updatedSections, setUpdatedSections] = useState<ReadonlySet<CvSectionKey>>(NO_SECTIONS);
  const [dismissedFlags, setDismissedFlags] = useState<ReadonlySet<string>>(() => new Set());

  const handleSaved = useCallback((patch: CvPatch) => {
    if (patch.title !== undefined) setPendingTitle((current) => (current === patch.title ? null : current));
  }, []);

  const handleConflict = useCallback(({ kept, dropped }: ConflictResolution) => {
    setPendingTitle(null);
    setDismissedFlags(new Set());
    if (dropped.length > 0) {
      toast.warning("This CV was changed elsewhere", {
        description: `Your edits to ${describeUnits(dropped)} were replaced by the newer version.${kept.length > 0 ? " Your other edits were kept." : ""}`,
      });
    } else if (kept.length > 0) {
      toast.info("This CV was changed elsewhere", { description: "Your edits were kept and saved on top of the newer version." });
    } else {
      toast.info("This CV was changed elsewhere", { description: "Showing the latest version." });
    }
  }, []);

  const autosave = useCvAutosave({
    cv,
    refetch,
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

  const dismissFlags = (flagIds: string[]) => {
    setDismissedFlags((current) => new Set([...current, ...flagIds]));
    autosave.dismissFlags(flagIds);
  };

  const renameCv = (title: string) => {
    setPendingTitle(title);
    autosave.saveTitle(title);
  };

  const openQuestions = cv.questions.filter(needsAnswer).length;
  const showQuestions = !isDesktop || cv.questions.length > 0;

  const panelProps = (tab: WorkspaceTab) =>
    isDesktop
      ? {}
      : { role: "tabpanel", id: panelId(tabsId, tab), "aria-labelledby": tabId(tabsId, tab), hidden: activeTab !== tab };

  const changeTab = (tab: WorkspaceTab) => {
    const url = new URL(window.location.href);
    if (tab === "edit") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    // The History API updates useSearchParams without a server round trip.
    window.history.replaceState(null, "", url);
    const tabs = tabsRef.current;
    if (!tabs) return;
    const top = tabs.getBoundingClientRect().top + window.scrollY - APP_HEADER_PX;
    if (window.scrollY > top) window.scrollTo({ top });
  };

  const showInvalidField = () => {
    if (!isDesktop && activeTab !== "edit") changeTab("edit");
    focusFirstInvalidField(editorRef.current);
  };

  // Claude rewrites and the PDF renders the server copy: save edits first.
  const ensureSaved = async (): Promise<SaveCheck> => {
    if (autosave.invalid) {
      showInvalidField();
      return "invalid";
    }
    return (await autosave.flush()) ? null : "unsaved";
  };

  const prepareAnswer = async (): Promise<string | null> => {
    const problem = await ensureSaved();
    if (problem === "invalid") return "Fix the highlighted fields in your CV first: your edits are saved before Claude updates it.";
    if (problem === "unsaved") return "Your latest edits aren't saved yet, so Claude can't update the CV right now. Try again in a moment.";
    return null;
  };

  const saveStatus = (
    <SaveStatus state={autosave.state} invalid={autosave.invalid} onRetry={autosave.retry} onShowInvalid={showInvalidField} />
  );
  const downloadButton = (
    <DownloadPdfButton cvId={cv.id} title={pendingTitle ?? cv.title} ensureSaved={ensureSaved} disabled={cv.busy} />
  );

  return (
    <FormProvider {...form}>
      <div data-layout="wide" className="space-y-5 lg:space-y-6">
        <header className="space-y-3">
          <BackToCvsLink />
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
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
            {isDesktop && (
              <div className="flex shrink-0 items-center gap-4">
                {saveStatus}
                {downloadButton}
              </div>
            )}
          </div>
        </header>

        {cv.busy && <BusyBanner connectionLost={refetchFailed} />}

        {!isDesktop && (
          <WorkspaceTabs
            ref={tabsRef}
            idPrefix={tabsId}
            value={activeTab}
            onChange={changeTab}
            openQuestions={openQuestions}
          />
        )}

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
          <div className="min-w-0 space-y-6">
            {showQuestions && (
              <div {...panelProps("questions")}>
                <QuestionsPanel cv={cv} prepareAnswer={prepareAnswer} showEmptyState={!isDesktop} />
              </div>
            )}

            <div {...panelProps("edit")}>
              <ReviewProvider
                review={cv.review}
                dismissed={dismissedFlags}
                onDismiss={dismissFlags}
                disabled={cv.busy}
              >
                <div className="space-y-4">
                  {!isDesktop && openQuestions > 0 && (
                    <QuestionsHint
                      count={openQuestions}
                      onOpen={() => {
                        changeTab("questions");
                        // The hint hides with its panel: move focus to the tab that was opened.
                        document.getElementById(tabId(tabsId, "questions"))?.focus();
                      }}
                    />
                  )}
                  <ReviewNotice removed={cv.review?.removed ?? []} />
                  <form ref={editorRef} noValidate onSubmit={(event) => event.preventDefault()}>
                    <CvEditor targetRole={cv.targetRole} readOnly={cv.busy} updatedSections={updatedSections} />
                  </form>
                </div>
              </ReviewProvider>
            </div>
          </div>

          <aside
            aria-label={isDesktop ? "Preview" : undefined}
            className="mt-0 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pb-2"
            {...panelProps("preview")}
          >
            <CvPreview />
          </aside>
        </div>

        {!isDesktop && <MobileActionBar status={saveStatus} action={downloadButton} />}
      </div>
    </FormProvider>
  );
}

function QuestionsHint({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-warning-soft-fg">
      <MessageCircleQuestion aria-hidden="true" className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        Claude has {count === 1 ? "a question" : `${count} questions`} that can improve your CV.
      </p>
      <Button size="sm" variant="secondary" onClick={onOpen} className="-my-1">
        Answer
      </Button>
    </div>
  );
}
