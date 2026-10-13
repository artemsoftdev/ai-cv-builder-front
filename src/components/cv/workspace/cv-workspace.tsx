"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Target } from "lucide-react";
import { useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";

import type { CvContent } from "@/lib/api/types";
import { cvContentSchema } from "@/lib/cv/content-schema";
import type { ReadyCv } from "@/lib/cv/ready-cv";
import type { CvSectionKey } from "@/lib/cv/sections";
import { useFocusOnMount } from "@/lib/hooks/use-focus-on-mount";

import { BackToCvsLink } from "../cv-page-shell";
import { CvEditor } from "../editor/cv-editor";

type CvWorkspaceProps = {
  cv: ReadyCv;
  dataUpdatedAt: number;
  refetchFailed: boolean;
  onRetryRefetch: () => void;
  /** Focus the title (the CV just finished generating while the page was open). */
  autoFocus?: boolean;
};

const NO_SECTIONS: ReadonlySet<CvSectionKey> = new Set();

/** Editor for a generated CV. */
export function CvWorkspace({ cv, autoFocus = false }: CvWorkspaceProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useFocusOnMount(headingRef, autoFocus);

  const form = useForm<CvContent>({
    resolver: zodResolver(cvContentSchema),
    // A copy: RHF mutates its values in place and must never touch the query cache.
    defaultValues: structuredClone(cv.content),
    mode: "onChange",
  });

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
        <div className="space-y-3">
          <BackToCvsLink />
          <div className="min-w-0">
            <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight break-words outline-none sm:text-3xl">
              {cv.title}
            </h1>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-fg-muted">
              <Target aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
              <span className="truncate">{cv.targetRole}</span>
            </p>
          </div>
        </div>
        <form noValidate onSubmit={(event) => event.preventDefault()}>
          <CvEditor targetRole={cv.targetRole} readOnly={cv.busy} updatedSections={NO_SECTIONS} />
        </form>
      </div>
    </FormProvider>
  );
}
