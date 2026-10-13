"use client";

import { Wrench } from "lucide-react";
import { useId, type ReactNode } from "react";
import { useController, useWatch } from "react-hook-form";

import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { API_LIMITS, type CvContent } from "@/lib/api/types";
import { newSkillGroup } from "@/lib/cv/new-item";

import { useEditor } from "./editor-context";
import { EntryList } from "./entry-list";
import { FormTextField } from "./form-text-field";
import { TagInput } from "./tag-input";

export function SkillsSection({ updated }: { updated: boolean }) {
  return (
    <EntryList
      name="skills"
      title="Skills"
      icon={<Wrench />}
      updated={updated}
      max={API_LIMITS.content.skillGroups}
      emptyText="No skills yet."
      addLabel="Add skill group"
      removedMessage="Skill group removed"
      firstField="name"
      newEntry={newSkillGroup}
    >
      {({ index, actions }) => <SkillGroupEditor index={index} actions={actions} />}
    </EntryList>
  );
}

type SkillGroupEditorProps = { index: number; actions: (label: string) => ReactNode };

function SkillGroupEditor({ index, actions }: SkillGroupEditorProps) {
  const { readOnly } = useEditor();
  const name = useWatch<CvContent, `skills.${number}.name`>({ name: `skills.${index}.name` });
  const label = name.trim() || "Untitled group";
  const { field, fieldState } = useController<CvContent, `skills.${number}.items`>({ name: `skills.${index}.items` });
  const inputId = useId();
  const errorId = `${inputId}-error`;
  // The error is on the array (too many) or on one of its items (too long).
  const itemErrors = fieldState.error as { message?: string } | Array<{ message?: string } | undefined> | undefined;
  const error = Array.isArray(itemErrors) ? itemErrors.find((entry) => entry?.message)?.message : itemErrors?.message;

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <FormTextField name={`skills.${index}.name`} label="Group" placeholder="e.g. Languages" className="flex-1" />
        {actions(`skill group ${label}`)}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={inputId}>Skills in {label}</Label>
        <TagInput
          id={inputId}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          max={API_LIMITS.content.skillsPerGroup}
          maxItemLength={API_LIMITS.content.string}
          invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          disabled={readOnly}
          placeholder="Type a skill and press Enter"
        />
        <FieldError id={errorId} message={error} />
      </div>
    </div>
  );
}
