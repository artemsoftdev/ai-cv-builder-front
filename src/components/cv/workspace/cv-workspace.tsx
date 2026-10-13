"use client";

import { PenLine } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

import type { ReadyCv } from "@/lib/cv/ready-cv";

import { CvPageShell } from "../cv-page-shell";

type CvWorkspaceProps = {
  cv: ReadyCv;
  dataUpdatedAt: number;
  refetchFailed: boolean;
  onRetryRefetch: () => void;
  autoFocus?: boolean;
};

// Temporary: the editor replaces this.
export function CvWorkspace({ cv }: CvWorkspaceProps) {
  return (
    <CvPageShell>
      <EmptyState icon={<PenLine />} title={cv.title} description="The editor is on its way." />
    </CvPageShell>
  );
}
