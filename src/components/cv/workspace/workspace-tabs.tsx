"use client";

import { Eye, MessageCircleQuestion, PenLine } from "lucide-react";
import type { Ref } from "react";

import { SegmentedTabs, type SegmentedTabOption } from "@/components/ui/segmented-tabs";

export type WorkspaceTab = "edit" | "preview" | "questions";

const WORKSPACE_TABS: readonly string[] = ["edit", "preview", "questions"] satisfies WorkspaceTab[];

export function parseWorkspaceTab(value: string | null): WorkspaceTab {
  return value !== null && WORKSPACE_TABS.includes(value) ? (value as WorkspaceTab) : "edit";
}

// Below 400px the labels win over the icons.
const ICON = "size-4 shrink-0 max-[25rem]:hidden";

type WorkspaceTabsProps = {
  idPrefix: string;
  value: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
  openQuestions: number;
  ref?: Ref<HTMLDivElement>;
};

export function WorkspaceTabs({ idPrefix, value, onChange, openQuestions, ref }: WorkspaceTabsProps) {
  const options: SegmentedTabOption<WorkspaceTab>[] = [
    { value: "edit", label: "Edit", icon: <PenLine aria-hidden="true" className={ICON} /> },
    { value: "preview", label: "Preview", icon: <Eye aria-hidden="true" className={ICON} /> },
    {
      value: "questions",
      label: "Questions",
      icon: <MessageCircleQuestion aria-hidden="true" className={ICON} />,
      badge:
        openQuestions > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-xs font-semibold text-fg">
            {openQuestions}
            <span className="sr-only"> open</span>
          </span>
        ) : undefined,
    },
  ];

  return (
    <div
      ref={ref}
      className="sticky top-16 z-30 -mx-4 bg-canvas/90 px-4 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/75"
    >
      <SegmentedTabs label="CV workspace" idPrefix={idPrefix} options={options} value={value} onChange={onChange} />
    </div>
  );
}
