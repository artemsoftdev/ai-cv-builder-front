"use client";

import { Plus, Wrench } from "lucide-react";
import { motion } from "motion/react";
import { useId } from "react";
import { useController, useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { API_LIMITS, type CvContent } from "@/lib/api/types";
import { newSkillGroup } from "@/lib/cv/new-item";

import { useEditor } from "./editor-context";
import { FormTextField } from "./form-text-field";
import { ItemActions } from "./item-actions";
import { SectionCard } from "./section-card";
import { TagInput } from "./tag-input";
import { removeWithUndo } from "./remove-with-undo";

export function SkillsSection({ updated }: { updated: boolean }) {
  const { control, getValues } = useFormContext<CvContent>();
  const { fields, append, insert, remove, move } = useFieldArray({ control, name: "skills", keyName: "key" });
  const max = API_LIMITS.content.skillGroups;

  return (
    <SectionCard section="skills" title="Skills" icon={<Wrench />} count={fields.length} updated={updated}>
      {fields.length === 0 ? (
        <p className="text-sm text-fg-muted">No skills yet.</p>
      ) : (
        <ol className="space-y-4">
          {fields.map((field, index) => (
            <motion.li
              key={field.key}
              layout="position"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-lg border border-border bg-canvas/60 p-3 sm:p-4"
            >
              <SkillGroupEditor
                index={index}
                itemId={field.id}
                count={fields.length}
                onMove={move}
                onRemove={() =>
                  removeWithUndo({
                    index,
                    value: getValues(`skills.${index}`),
                    remove,
                    insert: (at, group) => insert(at, group),
                    message: "Skill group removed",
                  })
                }
              />
            </motion.li>
          ))}
        </ol>
      )}
      <Button
        variant="secondary"
        size="sm"
        className="mt-4"
        leftIcon={<Plus aria-hidden="true" className="size-4" />}
        disabled={fields.length >= max}
        onClick={() => append(newSkillGroup(), { shouldFocus: true })}
      >
        Add skill group
      </Button>
    </SectionCard>
  );
}

type SkillGroupEditorProps = {
  index: number;
  itemId: string;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
};

function SkillGroupEditor({ index, itemId, count, onMove, onRemove }: SkillGroupEditorProps) {
  const { readOnly } = useEditor();
  const name = useWatch<CvContent, `skills.${number}.name`>({ name: `skills.${index}.name` });
  const label = name.trim() || "Untitled group";
  const { field, fieldState } = useController<CvContent, `skills.${number}.items`>({ name: `skills.${index}.items` });
  const inputId = useId();
  const errorId = `${inputId}-error`;
  // An error on the array itself (too many) or on one of its strings (too long).
  const itemErrors = fieldState.error as { message?: string } | Array<{ message?: string } | undefined> | undefined;
  const error = Array.isArray(itemErrors) ? itemErrors.find((entry) => entry?.message)?.message : itemErrors?.message;

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <FormTextField name={`skills.${index}.name`} label="Group" placeholder="e.g. Languages" className="flex-1" />
        <ItemActions itemId={itemId} index={index} count={count} label={`skill group ${label}`} onMove={onMove} onRemove={onRemove} />
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
