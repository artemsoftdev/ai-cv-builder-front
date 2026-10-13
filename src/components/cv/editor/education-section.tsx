"use client";

import { GraduationCap } from "lucide-react";
import type { ReactNode } from "react";
import { useWatch } from "react-hook-form";

import { API_LIMITS, type CvContent } from "@/lib/api/types";
import { newEducationItem } from "@/lib/cv/new-item";

import { EntryHeader, EntryList } from "./entry-list";
import { FormTextField } from "./form-text-field";

export function EducationSection({ updated }: { updated: boolean }) {
  return (
    <EntryList
      name="education"
      title="Education"
      icon={<GraduationCap />}
      updated={updated}
      max={API_LIMITS.content.educationItems}
      emptyText="No education entries yet."
      addLabel="Add education"
      removedMessage="Education entry removed"
      firstField="degree"
      newEntry={newEducationItem}
    >
      {({ index, itemId, actions }) => <EducationItemEditor index={index} itemId={itemId} actions={actions} />}
    </EntryList>
  );
}

type EducationItemEditorProps = { index: number; itemId: string; actions: (label: string) => ReactNode };

function EducationItemEditor({ index, itemId, actions }: EducationItemEditorProps) {
  const [degree, institution] = useWatch<CvContent, [`education.${number}.degree`, `education.${number}.institution`]>({
    name: [`education.${index}.degree`, `education.${index}.institution`],
  });
  const heading = [degree, institution].map((part) => part.trim()).filter(Boolean).join(" · ") || "New education entry";

  return (
    <div className="space-y-4">
      <EntryHeader heading={heading} itemId={itemId} actions={actions(`education ${heading}`)} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4">
        <FormTextField
          name={`education.${index}.degree`}
          label="Degree"
          placeholder="e.g. BSc Computer Science"
          className="col-span-2 sm:col-span-1"
        />
        <FormTextField name={`education.${index}.institution`} label="Institution" className="col-span-2 sm:col-span-1" />
        <FormTextField name={`education.${index}.location`} label="Location" className="col-span-2" />
        <FormTextField name={`education.${index}.startDate`} label="Start" />
        <FormTextField name={`education.${index}.endDate`} label="End" />
        <FormTextField
          name={`education.${index}.details`}
          label="Details"
          multiline
          rows={2}
          maxLength={API_LIMITS.content.educationDetails}
          placeholder="Honours, thesis, relevant coursework"
          className="col-span-2"
        />
      </div>
    </div>
  );
}
