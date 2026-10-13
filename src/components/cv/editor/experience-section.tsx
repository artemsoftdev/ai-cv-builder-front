"use client";

import { Briefcase } from "lucide-react";
import type { ReactNode } from "react";
import { useWatch } from "react-hook-form";

import { API_LIMITS, type CvContent } from "@/lib/api/types";
import { newExperienceItem } from "@/lib/cv/new-item";

import { BulletList } from "./bullet-list";
import { EntryHeader, EntryList } from "./entry-list";
import { FormTextField } from "./form-text-field";

export function ExperienceSection({ updated }: { updated: boolean }) {
  return (
    <EntryList
      name="experience"
      title="Experience"
      icon={<Briefcase />}
      updated={updated}
      max={API_LIMITS.content.experienceItems}
      emptyText="No positions yet."
      addLabel="Add position"
      removedMessage="Position removed"
      firstField="title"
      newEntry={newExperienceItem}
    >
      {({ index, itemId, actions }) => <ExperienceItemEditor index={index} itemId={itemId} actions={actions} />}
    </EntryList>
  );
}

type ExperienceItemEditorProps = { index: number; itemId: string; actions: (label: string) => ReactNode };

function ExperienceItemEditor({ index, itemId, actions }: ExperienceItemEditorProps) {
  const [title, company] = useWatch<CvContent, [`experience.${number}.title`, `experience.${number}.company`]>({
    name: [`experience.${index}.title`, `experience.${index}.company`],
  });
  const heading = [title, company].map((part) => part.trim()).filter(Boolean).join(" · ") || "New position";

  return (
    <div className="space-y-4">
      <EntryHeader heading={heading} itemId={itemId} actions={actions(`position ${heading}`)} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4">
        <FormTextField name={`experience.${index}.title`} label="Job title" className="col-span-2 sm:col-span-1" />
        <FormTextField name={`experience.${index}.company`} label="Company" className="col-span-2 sm:col-span-1" />
        <FormTextField name={`experience.${index}.location`} label="Location" className="col-span-2" />
        <FormTextField name={`experience.${index}.startDate`} label="Start" placeholder="e.g. Mar 2021" />
        <FormTextField name={`experience.${index}.endDate`} label="End" placeholder="e.g. Present" />
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-fg">Highlights</h4>
        <BulletList itemIndex={index} />
      </div>
    </div>
  );
}
