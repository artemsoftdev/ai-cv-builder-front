"use client";

import { GraduationCap, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { API_LIMITS, type CvContent } from "@/lib/api/types";
import { newEducationItem } from "@/lib/cv/new-item";

import { ItemReview } from "../review/item-review";
import { FormTextField } from "./form-text-field";
import { ItemActions } from "./item-actions";
import { SectionCard } from "./section-card";
import { removeWithUndo } from "./use-undoable-remove";

export function EducationSection({ updated }: { updated: boolean }) {
  const { control, getValues } = useFormContext<CvContent>();
  const { fields, append, insert, remove, move } = useFieldArray({ control, name: "education", keyName: "key" });
  const max = API_LIMITS.content.educationItems;

  return (
    <SectionCard section="education" title="Education" icon={<GraduationCap />} count={fields.length} updated={updated}>
      {fields.length === 0 ? (
        <p className="text-sm text-fg-muted">No education entries yet.</p>
      ) : (
        <ol className="space-y-4">
          {fields.map((field, index) => (
            <motion.li
              key={field.key}
              layout="position"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              data-review-scope
              className="rounded-lg border border-border bg-canvas/60 p-3 sm:p-4"
            >
              <EducationItemEditor
                index={index}
                itemId={field.id}
                count={fields.length}
                onMove={move}
                onRemove={() =>
                  removeWithUndo({
                    index,
                    value: getValues(`education.${index}`),
                    remove,
                    insert: (at, item) => insert(at, item),
                    message: "Education entry removed",
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
        onClick={() => append(newEducationItem(), { shouldFocus: true })}
      >
        Add education
      </Button>
    </SectionCard>
  );
}

type EducationItemEditorProps = {
  index: number;
  itemId: string;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
};

function EducationItemEditor({ index, itemId, count, onMove, onRemove }: EducationItemEditorProps) {
  const [degree, institution] = useWatch<CvContent, [`education.${number}.degree`, `education.${number}.institution`]>({
    name: [`education.${index}.degree`, `education.${index}.institution`],
  });
  const heading = [degree, institution].map((part) => part.trim()).filter(Boolean).join(" · ") || "New education entry";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 pt-2 text-sm font-semibold break-words text-fg">{heading}</h3>
        <ItemReview itemId={itemId} label={`“${heading}”`} />
        <ItemActions itemId={itemId} index={index} count={count} label={`education ${heading}`} onMove={onMove} onRemove={onRemove} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormTextField name={`education.${index}.degree`} label="Degree" placeholder="e.g. BSc Computer Science" />
        <FormTextField name={`education.${index}.institution`} label="Institution" />
        <FormTextField name={`education.${index}.location`} label="Location" className="sm:col-span-2" />
        <FormTextField name={`education.${index}.startDate`} label="Start" />
        <FormTextField name={`education.${index}.endDate`} label="End" />
        <FormTextField
          name={`education.${index}.details`}
          label="Details"
          multiline
          rows={2}
          maxLength={API_LIMITS.content.educationDetails}
          placeholder="Honours, thesis, relevant coursework"
          className="sm:col-span-2"
        />
      </div>
    </div>
  );
}
